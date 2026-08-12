import { NextResponse } from "next/server";
import { z } from "zod";
import { addDemoComment, listDemoComments } from "@/lib/server/comments-repository";
import { AccessError, accessErrorResponse, getDemoBookIdBySlug, getDemoPublishedBook, getOptionalIdentity, getServiceDatabase, requireIdentity } from "@/lib/server/request-auth";

const createSchema = z.object({
  body: z.string().trim().min(1).max(500),
  versionId: z.string().min(1),
  pageNumber: z.number().int().min(1).max(500).optional(),
});

export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const identity = await getOptionalIdentity(request);
    const database = identity?.database ?? getServiceDatabase();
    if (!database) {
      const bookId = getDemoBookIdBySlug(slug);
      const published = bookId ? getDemoPublishedBook(bookId) : undefined;
      if (!bookId || !published) return NextResponse.json({ error: "摄影书不存在" }, { status: 404 });
      return NextResponse.json({ comments: listDemoComments(bookId, published.versionId, identity?.id) });
    }

    const { data: book } = await database.from("books")
      .select("id, author_id, current_version_id, visibility")
      .eq("slug", slug)
      .in("visibility", ["public", "unlisted"])
      .maybeSingle();
    if (!book?.current_version_id) return NextResponse.json({ error: "摄影书不存在" }, { status: 404 });
    const { data, error } = await database.from("book_comments")
      .select("id, book_id, version_id, user_id, body, page_number, created_at, profiles(display_name, avatar_initial)")
      .eq("book_id", book.id)
      .eq("version_id", book.current_version_id)
      .eq("status", "visible")
      .order("created_at", { ascending: true });
    if (error) throw new Error("无法加载评论");
    return NextResponse.json({ comments: (data ?? []).map((row: Record<string, unknown>) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      const displayName = String((profile as { display_name?: string } | null)?.display_name || "读者");
      return {
        id: row.id,
        bookId: row.book_id,
        versionId: row.version_id,
        userId: row.user_id,
        authorName: displayName,
        authorInitial: String((profile as { avatar_initial?: string } | null)?.avatar_initial || displayName.slice(0, 1)),
        body: row.body,
        pageNumber: row.page_number,
        createdAt: row.created_at,
        canDelete: Boolean(identity && (row.user_id === identity.id || book.author_id === identity.id)),
      };
    }) });
  } catch (error) {
    return accessErrorResponse(error);
  }
}

export async function POST(request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    const identity = await requireIdentity(request);
    const input = createSchema.parse(await request.json());
    if (identity.demo) {
      const bookId = getDemoBookIdBySlug(slug);
      const published = bookId ? getDemoPublishedBook(bookId) : undefined;
      if (!bookId || !published?.commentsEnabled) throw new AccessError("这本摄影书未开放评论", 403);
      if (input.versionId !== published.versionId) throw new AccessError("公开版本已经更新，请刷新页面", 409);
      const comment = addDemoComment({
        bookId,
        versionId: input.versionId,
        userId: identity.id,
        authorName: identity.name,
        body: input.body,
        pageNumber: input.pageNumber,
        canDelete: true,
      });
      return NextResponse.json({ comment }, { status: 201 });
    }

    const { data: book } = await identity.database!.from("books")
      .select("id, current_version_id, visibility, comments_enabled")
      .eq("slug", slug)
      .maybeSingle();
    if (!book || book.visibility === "draft" || !book.comments_enabled) throw new AccessError("这本摄影书未开放评论", 403);
    if (book.current_version_id !== input.versionId) throw new AccessError("公开版本已经更新，请刷新页面", 409);
    const { data, error } = await identity.database!.from("book_comments").insert({
      book_id: book.id,
      version_id: input.versionId,
      user_id: identity.id,
      body: input.body,
      page_number: input.pageNumber,
    }).select("id, book_id, version_id, user_id, body, page_number, created_at").single();
    if (error) throw new Error("评论发布失败");
    return NextResponse.json({ comment: {
      id: data.id,
      bookId: data.book_id,
      versionId: data.version_id,
      userId: data.user_id,
      authorName: identity.name,
      authorInitial: identity.name.slice(0, 1),
      body: data.body,
      pageNumber: data.page_number,
      createdAt: data.created_at,
      canDelete: true,
    } }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "评论内容无效" }, { status: 400 });
    return accessErrorResponse(error);
  }
}
