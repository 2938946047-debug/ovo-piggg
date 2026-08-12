import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEMO_AUTHOR, DEMO_READER } from "@/lib/demo-auth";
import type { SceneDocumentV1 } from "@/types/book";

export interface RequestIdentity {
  id: string;
  email: string;
  name: string;
  demo: boolean;
  database?: SupabaseClient;
}

export class AccessError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

const demoBookOwners = new Map<string, string>([["book_demo", DEMO_AUTHOR.id]]);
const demoBookSlugs = new Map<string, string>([["white-coast-study", "book_demo"]]);
interface DemoPublishedBook {
  versionId: string;
  aiEnabled: boolean;
  commentsEnabled: boolean;
  visibility?: "unlisted" | "public";
  slug?: string;
  title?: string;
  subtitle?: string;
  description?: string;
  author?: string;
  publishedAt?: string;
  document?: SceneDocumentV1;
}

const demoPublishedBooks = new Map<string, DemoPublishedBook>([
  ["book_demo", { versionId: "version_demo_public", aiEnabled: true, commentsEnabled: true }],
]);

function getSupabaseConfiguration() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  return url && anonKey && serviceKey ? { url, anonKey, serviceKey } : null;
}

export function getServiceDatabase() {
  const configuration = getSupabaseConfiguration();
  return configuration
    ? createClient(configuration.url, configuration.serviceKey, { auth: { persistSession: false } })
    : undefined;
}

export function registerDemoBookOwner(bookId: string, userId: string, slug?: string) {
  demoBookOwners.set(bookId, userId);
  if (slug) demoBookSlugs.set(slug, bookId);
}

export function getDemoBookIdBySlug(slug: string) {
  return demoBookSlugs.get(slug);
}

export function getDemoBookOwner(bookId: string) {
  return demoBookOwners.get(bookId);
}

export function setDemoPublishedBook(bookId: string, value: DemoPublishedBook) {
  demoPublishedBooks.set(bookId, value);
  if (value.slug) demoBookSlugs.set(value.slug, bookId);
}

export function getDemoPublishedBook(bookId: string) {
  return demoPublishedBooks.get(bookId);
}

export async function getOptionalIdentity(request: Request): Promise<RequestIdentity | null> {
  const configuration = getSupabaseConfiguration();
  if (!configuration) {
    const userId = request.headers.get("x-demo-user-id");
    const user = userId === DEMO_AUTHOR.id ? DEMO_AUTHOR : userId === DEMO_READER.id ? DEMO_READER : null;
    return user ? { ...user, demo: true } : null;
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return null;
  const authClient = createClient(configuration.url, configuration.anonKey, {
    global: { headers: { authorization: `Bearer ${token}` } },
    auth: { persistSession: false },
  });
  const { data, error } = await authClient.auth.getUser(token);
  if (error || !data.user) return null;
  const database = getServiceDatabase()!;
  const name = String(data.user.user_metadata?.display_name || data.user.email?.split("@")[0] || "读者");
  return { id: data.user.id, email: data.user.email || "", name, demo: false, database };
}

export async function requireIdentity(request: Request) {
  const identity = await getOptionalIdentity(request);
  if (!identity) throw new AccessError("请先登录", 401);
  return identity;
}

export async function requireBookOwner(request: Request, bookId: string) {
  const identity = await requireIdentity(request);
  if (identity.demo) {
    if (demoBookOwners.get(bookId) !== identity.id) throw new AccessError("只有作者可以修改这本摄影书", 403);
    return identity;
  }

  const { data, error } = await identity.database!
    .from("books")
    .select("author_id")
    .eq("id", bookId)
    .maybeSingle();
  if (error) throw new AccessError("无法验证摄影书权限", 502);
  if (!data) throw new AccessError("摄影书不存在", 404);
  if (data.author_id !== identity.id) throw new AccessError("只有作者可以修改这本摄影书", 403);
  return identity;
}

export function accessErrorResponse(error: unknown) {
  const status = error instanceof AccessError ? error.status : 500;
  const message = error instanceof Error ? error.message : "请求失败";
  return Response.json({ error: message }, { status });
}
