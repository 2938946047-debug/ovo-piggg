import { NextResponse } from "next/server";
import { sampleBook } from "@/lib/sample-book";
import { getDemoBookIdBySlug, getDemoPublishedBook, getServiceDatabase } from "@/lib/server/request-auth";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const database = getServiceDatabase();
  if (database) {
    const { data: book } = await database.from("books")
      .select("id, author_id, slug, title, subtitle, description, visibility, ai_enabled, comments_enabled, current_version_id")
      .eq("slug", slug)
      .in("visibility", ["public", "unlisted"])
      .maybeSingle();
    if (!book?.current_version_id) return NextResponse.json({ error: "摄影书不存在或尚未公开" }, { status: 404 });
    const { data: version } = await database.from("book_versions")
      .select("id, document, published_at")
      .eq("id", book.current_version_id)
      .single();
    if (!version) return NextResponse.json({ error: "公开版本不存在" }, { status: 404 });
    const { data: profile } = await database.from("profiles").select("display_name").eq("id", book.author_id).maybeSingle();
    return NextResponse.json({
      id: book.id,
      slug: book.slug,
      title: book.title,
      subtitle: book.subtitle,
      author: profile?.display_name || "创作者",
      description: book.description,
      aiEnabled: book.ai_enabled,
      commentsEnabled: book.comments_enabled,
      visibility: book.visibility,
      publishedSnapshot: { id: version.id, publishedAt: version.published_at, document: version.document },
    }, { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } });
  }
  const demoBookId = getDemoBookIdBySlug(slug);
  const demoPublished = demoBookId ? getDemoPublishedBook(demoBookId) : undefined;
  if (demoBookId && demoPublished?.document) {
    return NextResponse.json({
      id: demoBookId,
      slug,
      title: demoPublished.title || "未命名摄影书",
      subtitle: demoPublished.subtitle || "",
      author: demoPublished.author || "创作者",
      description: demoPublished.description || "",
      aiEnabled: demoPublished.aiEnabled,
      commentsEnabled: demoPublished.commentsEnabled,
      visibility: demoPublished.visibility || "unlisted",
      publishedSnapshot: {
        id: demoPublished.versionId,
        publishedAt: demoPublished.publishedAt || new Date().toISOString(),
        document: demoPublished.document,
      },
    }, { headers: { "cache-control": "no-store" } });
  }
  if (slug !== sampleBook.slug) return NextResponse.json({ error: "摄影书不存在或尚未公开" }, { status: 404 });
  const snapshot = sampleBook.publishedSnapshot ?? { id: "demo-preview", publishedAt: sampleBook.updatedAt, document: sampleBook.document };
  return NextResponse.json({
    id: sampleBook.id,
    slug: sampleBook.slug,
    title: sampleBook.title,
    subtitle: sampleBook.subtitle,
    author: sampleBook.author,
    description: sampleBook.description,
    aiEnabled: sampleBook.aiEnabled,
    commentsEnabled: sampleBook.commentsEnabled,
    visibility: sampleBook.status === "draft" ? "public" : sampleBook.status,
    publishedSnapshot: snapshot,
  }, { headers: { "cache-control": "public, max-age=60, stale-while-revalidate=300" } });
}
