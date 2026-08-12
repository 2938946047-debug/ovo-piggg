import { NextResponse } from "next/server";
import { validateWhitePagePolicy } from "@/lib/document-policy";
import { accessErrorResponse, requireBookOwner } from "@/lib/server/request-auth";

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body.bookId !== "string" || body.page?.id !== id) return NextResponse.json({ error: "页面或摄影书标识无效" }, { status: 400 });
    await requireBookOwner(request, body.bookId);
    const policy = validateWhitePagePolicy({ version: 1, backgroundPolicy: body.backgroundPolicy, pages: [body.page] });
    if (!policy.valid) return NextResponse.json({ error: policy.error }, { status: 422 });
    return NextResponse.json({ page: body.page, savedAt: new Date().toISOString(), indexStatus: "scheduled" });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
