import { NextResponse } from "next/server";
import { z } from "zod";
import { validateWhitePagePolicy } from "@/lib/document-policy";
import { accessErrorResponse, requireBookOwner, setDemoPublishedBook } from "@/lib/server/request-auth";
import type { SceneDocumentV1 } from "@/types/book";

const schema = z.object({
  visibility: z.enum(["unlisted", "public"]),
  aiEnabled: z.boolean(),
  commentsEnabled: z.boolean(),
  slug: z.string().min(1).max(120),
  title: z.string().max(160),
  subtitle: z.string().max(240),
  description: z.string().max(2000),
  author: z.string().max(120),
  document: z.unknown(),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  try {
    const identity = await requireBookOwner(request, id);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "发布参数无效" }, { status: 400 });
    const policy = validateWhitePagePolicy(parsed.data.document);
    if (!policy.valid) return NextResponse.json({ error: policy.error }, { status: 422 });

    const versionId = `version_${crypto.randomUUID()}`;
    if (!identity.demo) {
      const { count } = await identity.database!.from("book_versions").select("id", { count: "exact", head: true }).eq("book_id", id);
      const liveVersionId = crypto.randomUUID();
      const { error: versionError } = await identity.database!.from("book_versions").insert({
        id: liveVersionId,
        book_id: id,
        version_number: (count ?? 0) + 1,
        document: parsed.data.document,
      });
      if (versionError) throw new Error("无法生成公开版本");
      const { error } = await identity.database!.from("books").update({
        slug: parsed.data.slug,
        title: parsed.data.title,
        subtitle: parsed.data.subtitle,
        description: parsed.data.description,
        draft_document: parsed.data.document,
        visibility: parsed.data.visibility,
        ai_enabled: parsed.data.aiEnabled,
        comments_enabled: parsed.data.commentsEnabled,
        current_version_id: liveVersionId,
      }).eq("id", id).eq("author_id", identity.id);
      if (error) throw new Error("无法发布摄影书");
      return NextResponse.json({ bookId: id, versionId: liveVersionId, visibility: parsed.data.visibility, publishedAt: new Date().toISOString(), moderation: "passed", publicIndex: "scheduled" });
    }
    const publishedAt = new Date().toISOString();
    setDemoPublishedBook(id, {
      versionId,
      aiEnabled: parsed.data.aiEnabled,
      commentsEnabled: parsed.data.commentsEnabled,
      visibility: parsed.data.visibility,
      slug: parsed.data.slug,
      title: parsed.data.title,
      subtitle: parsed.data.subtitle,
      description: parsed.data.description,
      author: parsed.data.author,
      publishedAt,
      document: structuredClone(parsed.data.document as SceneDocumentV1),
    });
    return NextResponse.json({
      bookId: id,
      versionId,
      visibility: parsed.data.visibility,
      publishedAt,
      moderation: "passed",
      publicIndex: "scheduled",
    });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
