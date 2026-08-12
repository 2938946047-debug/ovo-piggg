import { createHash } from "node:crypto";
import OpenAI from "openai";
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { DEMO_AUTHOR, DEMO_READER } from "@/lib/demo-auth";
import { getDemoBookOwner, getDemoPublishedBook } from "@/lib/server/request-auth";

const requestSchema = z.object({
  question: z.string().trim().min(2).max(1000),
  mode: z.enum(["draft", "published"]),
  conversation: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(3000) })).max(8).default([]),
  book: z.object({
    id: z.string(),
    versionId: z.string(),
    title: z.string().max(200),
    description: z.string().max(3000),
    pages: z.array(z.object({ id: z.string(), number: z.number(), name: z.string(), text: z.string().max(6000) })).max(50),
  }),
  context: z.object({
    pageId: z.string(),
    pageName: z.string(),
    pageText: z.string().max(8000).optional(),
    imageName: z.string().max(300).optional(),
    imageAlt: z.string().max(1000).optional(),
    imageUrl: z.string().max(8_000_000).optional(),
    location: z.string().max(300).optional(),
  }),
});

type AskInput = z.infer<typeof requestSchema>;
const dailyUsage = new Map<string, { day: string; count: number; timestamps: number[]; active: boolean }>();
const answerCache = new Map<string, { expiresAt: number; result: unknown }>();

interface RequestIdentity {
  userId: string;
  database?: SupabaseClient;
}

async function authorizeRequest(request: Request, input: AskInput): Promise<RequestIdentity> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !anonKey || !serviceKey) {
    const userId = request.headers.get("x-demo-user-id");
    if (userId !== DEMO_AUTHOR.id && userId !== DEMO_READER.id) throw new Error("请先完成邮箱验证");
    const ownerId = getDemoBookOwner(input.book.id);
    if (!ownerId) throw new Error("摄影书不存在");
    if (input.mode === "draft" && userId !== ownerId) throw new Error("无权读取这本摄影书的草稿");
    if (input.mode === "published") {
      const published = getDemoPublishedBook(input.book.id);
      if (!published?.aiEnabled) throw new Error("这本摄影书未开放公开问答");
      if (input.book.versionId !== published.versionId) throw new Error("公开版本已经更新，请刷新页面");
    }
    return { userId };
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("请先完成邮箱验证");
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.getUser(token);
  if (authError || !authData.user) throw new Error("登录状态已失效，请重新验证邮箱");

  const database = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: book, error: bookError } = await database
    .from("books")
    .select("author_id, visibility, ai_enabled, current_version_id")
    .eq("id", input.book.id)
    .single();
  if (bookError || !book) throw new Error("摄影书不存在");
  if (input.mode === "draft" && book.author_id !== authData.user.id) throw new Error("无权读取这本摄影书的草稿");
  if (input.mode === "published") {
    if (book.visibility === "draft" || !book.ai_enabled) throw new Error("这本摄影书未开放公开问答");
    if (book.current_version_id !== input.book.versionId) throw new Error("公开版本已经更新，请刷新页面");
  }
  return { userId: authData.user.id, database };
}

function checkLimit(userId: string) {
  const day = new Date().toISOString().slice(0, 10);
  const now = Date.now();
  const current = dailyUsage.get(userId);
  const record = current?.day === day ? current : { day, count: 0, timestamps: [], active: false };
  record.timestamps = record.timestamps.filter((stamp) => now - stamp < 60_000);
  if (record.active) throw new Error("上一条问题仍在回答，请稍候");
  if (record.count >= 10) throw new Error("今天的 10 次问答额度已用完");
  if (record.timestamps.length >= 5) throw new Error("提问太快，请稍后再试");
  record.count += 1;
  record.timestamps.push(now);
  record.active = true;
  dailyUsage.set(userId, record);
  return () => { record.active = false; dailyUsage.set(userId, record); };
}

function collectCitations(response: unknown) {
  const citations: Array<{ title: string; url: string; sourceType: "web" }> = [];
  const output = (response as { output?: Array<{ type?: string; content?: Array<{ annotations?: Array<{ type?: string; title?: string; url?: string }> }> }> }).output ?? [];
  for (const item of output) {
    for (const content of item.content ?? []) {
      for (const annotation of content.annotations ?? []) {
        if (annotation.type === "url_citation" && annotation.url) citations.push({ title: annotation.title || annotation.url, url: annotation.url, sourceType: "web" });
      }
    }
  }
  return citations;
}

async function retrieveBookContext(client: OpenAI, database: SupabaseClient | undefined, input: AskInput) {
  if (!database) return "";
  const embedding = await client.embeddings.create({ model: "text-embedding-3-small", input: input.question, encoding_format: "float" });
  const { data, error } = await database.rpc("match_book_context_chunks", {
    query_embedding: embedding.data[0].embedding,
    match_book_id: input.book.id,
    match_visibility: input.mode,
    match_version_id: input.mode === "published" ? input.book.versionId : null,
    match_count: 8,
  });
  if (error || !Array.isArray(data)) return "";
  return data.map((chunk: { page_number: number; content_type: string; searchable_text: string }) => `[第${chunk.page_number}页 / ${chunk.content_type}] ${chunk.searchable_text}`).join("\n");
}

async function liveAnswer(input: AskInput, identity: RequestIdentity) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const moderation = await client.moderations.create({ model: "omni-moderation-latest", input: input.question });
  if (moderation.results[0]?.flagged) throw new Error("这个问题无法处理，请换一种表达");
  const bookContext = input.book.pages.map((page) => `[第${page.number}页 ${page.name}] ${page.text}`).filter((value) => value.trim()).join("\n");
  const retrievedContext = await retrieveBookContext(client, identity.database, input);
  const conversation = input.conversation.slice(-6).map((message) => `${message.role === "user" ? "读者" : "助手"}：${message.content}`).join("\n");
  const prompt = [
    "你是摄影书内的资料问答助手。用简体中文回答。",
    "先区分摄影书内部信息、外部历史事实和视觉解读。外部事实必须有网页引用；证据不足时明确说“暂无足够资料”。",
    "不要猜测具体建筑或人物身份，不要把视觉推测写成事实。回答简洁，但保留关键证据和不确定性。",
    "即使问题不是识图问题，也要正常回答可核实的常识和地点问题。例如询问‘布拉格在哪’时，应说明国家与地理位置，并通过网页检索给出可靠来源。",
    `摄影书：${input.book.title}\n说明：${input.book.description}`,
    `整本书文本索引：\n${bookContext || "无"}`,
    `向量检索片段：\n${retrievedContext || "无"}`,
    `当前页：${input.context.pageName}\n页面文字：${input.context.pageText || "无"}\n照片名称：${input.context.imageName || "无"}\n照片说明：${input.context.imageAlt || "无"}\n公开地点：${input.context.location || "无"}`,
    `本次会话：\n${conversation || "无"}`,
    `问题：${input.question}`,
  ].join("\n\n");
  const content: Array<Record<string, unknown>> = [{ type: "input_text", text: prompt }];
  if (input.context.imageUrl && (input.context.imageUrl.startsWith("data:image/") || input.context.imageUrl.startsWith("https://"))) {
    content.push({ type: "input_image", image_url: input.context.imageUrl, detail: "low" });
  }
  const response = await client.responses.create({
    model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
    reasoning: { effort: "low", context: "current_turn" },
    text: { verbosity: "medium" },
    tools: [{ type: "web_search" }],
    include: ["web_search_call.action.sources"],
    input: [{ role: "user", content }],
    store: false,
    safety_identifier: createHash("sha256").update(identity.userId).digest("hex").slice(0, 32),
  } as never);
  const outputModeration = await client.moderations.create({ model: "omni-moderation-latest", input: response.output_text });
  if (outputModeration.results[0]?.flagged) throw new Error("回答未通过内容安全检查");
  const citations = [
    {
      title: `${input.book.title} · 第 ${input.book.pages.find((page) => page.id === input.context.pageId)?.number ?? 1} 页`,
      url: `#page-${input.context.pageId}`,
      sourceType: "book" as const,
    },
    ...collectCitations(response),
  ];
  return { answer: response.output_text, citations, mode: "live" };
}

export async function POST(request: Request) {
  let release = () => {};
  const startedAt = Date.now();
  let input: AskInput | undefined;
  let identity: RequestIdentity | undefined;
  let status = "error";
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "AI 服务尚未启用" }, { status: 503 });
    }
    input = requestSchema.parse(await request.json());
    identity = await authorizeRequest(request, input);
    release = checkLimit(createHash("sha256").update(identity.userId).digest("hex"));
    const key = createHash("sha256").update(`${input.mode}:${input.book.id}:${input.book.versionId}:${input.question.trim().toLowerCase()}`).digest("hex");
    const cached = answerCache.get(key);
    if (cached && cached.expiresAt > Date.now()) {
      status = "ok";
      return NextResponse.json({ ...(cached.result as object), cached: true });
    }
    const result = await liveAnswer(input, identity);
    answerCache.set(key, { expiresAt: Date.now() + 24 * 60 * 60 * 1000, result });
    status = "ok";
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI 暂时无法回答";
    status = /额度|太快|仍在回答/.test(message) ? "quota" : /无法处理|安全检查/.test(message) ? "blocked" : "error";
    const httpStatus = status === "quota" ? 429 : status === "blocked" ? 400 : /登录|无权|未开放/.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status: httpStatus });
  } finally {
    release();
    if (input && identity?.database) {
      await identity.database.from("ai_query_events").insert({
        user_id: identity.userId,
        book_id: input.book.id,
        version_id: input.mode === "published" ? input.book.versionId : null,
        mode: input.mode,
        question_hash: createHash("sha256").update(input.question.trim().toLowerCase()).digest("hex"),
        status,
        latency_ms: Date.now() - startedAt,
        cache_hit: false,
      }).then(() => undefined, () => undefined);
    }
  }
}
