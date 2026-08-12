import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { z } from "zod";
import { accessErrorResponse, requireIdentity } from "@/lib/server/request-auth";

const schema = z.object({
  filename: z.string().min(1).max(180),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/svg+xml"]),
});

export async function POST(request: Request) {
  try {
    const identity = await requireIdentity(request);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "文件类型或名称无效" }, { status: 400 });
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const safeName = parsed.data.filename.replace(/[^a-zA-Z0-9._-]/g, "-");
    const path = `originals/${identity.id}/${crypto.randomUUID()}-${safeName}`;
    if (!url || !key) return NextResponse.json({ mode: "demo", path, token: "local-demo", warning: "尚未连接 Supabase 私有存储" });
    const supabase = createClient(url, key, { auth: { persistSession: false } });
    const { data, error } = await supabase.storage.from("photobook-originals").createSignedUploadUrl(path);
    if (error) return NextResponse.json({ error: "无法创建上传凭证" }, { status: 502 });
    return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
