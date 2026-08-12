import { NextResponse } from "next/server";
import { validateWhitePagePolicy } from "@/lib/document-policy";
import { accessErrorResponse, requireBookOwner } from "@/lib/server/request-auth";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.bookId !== "string" || body.page?.id !== id) return NextResponse.json({ error: "页面或摄影书标识无效" }, { status: 400 });
    const identity = await requireBookOwner(request, body.bookId);
    const policy = validateWhitePagePolicy({ version: 1, backgroundPolicy: body.backgroundPolicy, pages: [body.page] });
    if (!policy.valid) return NextResponse.json({ error: policy.error }, { status: 422 });
    const documentPolicy = validateWhitePagePolicy(body.document);
    if (!documentPolicy.valid) return NextResponse.json({ error: documentPolicy.error }, { status: 422 });
    const savedAt = new Date().toISOString();
    if (!identity.demo) {
      const { error } = await identity.database!.from("books").update({
        title: typeof body.title === "string" ? body.title.slice(0, 160) : "未命名摄影书",
        subtitle: typeof body.subtitle === "string" ? body.subtitle.slice(0, 240) : "",
        description: typeof body.description === "string" ? body.description.slice(0, 2000) : "",
        ai_enabled: body.aiEnabled !== false,
        comments_enabled: body.commentsEnabled !== false,
        draft_document: body.document,
        updated_at: savedAt,
      }).eq("id", body.bookId).eq("author_id", identity.id);
      if (error) throw new Error("保存失败");
    }
    return NextResponse.json({ page: body.page, savedAt, indexStatus: "scheduled" });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
