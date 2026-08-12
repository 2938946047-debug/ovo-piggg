import { NextResponse } from "next/server";
import { z } from "zod";
import { validateWhitePagePolicy } from "@/lib/document-policy";
import { accessErrorResponse, requireBookOwner } from "@/lib/server/request-auth";

const schema = z.object({ bookId: z.string().min(1), type: z.enum(["pdf", "mp4"]), snapshot: z.unknown() });

export async function POST(request: Request) {
  try {
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "导出参数无效" }, { status: 400 });
    await requireBookOwner(request, parsed.data.bookId);
    const policy = validateWhitePagePolicy(parsed.data.snapshot);
    if (!policy.valid) return NextResponse.json({ error: policy.error }, { status: 422 });
    const workerUrl = process.env.RAILWAY_WORKER_URL;
    const workerToken = process.env.RAILWAY_WORKER_TOKEN;
    if (!workerUrl) return NextResponse.json({ error: "本地演示未连接 Railway 视频 Worker；PDF 导出可直接使用。" }, { status: 503 });
    const response = await fetch(`${workerUrl.replace(/\/$/, "")}/jobs`, {
      method: "POST",
      headers: { "content-type": "application/json", ...(workerToken ? { authorization: `Bearer ${workerToken}` } : {}) },
      body: JSON.stringify({ ...parsed.data, settings: { width: 1920, height: 1080, secondsPerPage: 5, fadeSeconds: 0.5, background: "#ffffff", audio: false } }),
    });
    if (!response.ok) return NextResponse.json({ error: "视频任务创建失败" }, { status: 502 });
    return NextResponse.json(await response.json());
  } catch (error) {
    return accessErrorResponse(error);
  }
}
