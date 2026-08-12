import { NextResponse } from "next/server";
import { z } from "zod";
import { accessErrorResponse, registerDemoBookOwner, requireIdentity } from "@/lib/server/request-auth";
import type { Photobook } from "@/types/book";

const schema = z.object({ title: z.string().trim().min(1).max(120).default("未命名摄影书") });

export async function GET(request: Request) {
  try {
    const identity = await requireIdentity(request);
    if (identity.demo) return NextResponse.json({ books: [] });
    const { data, error } = await identity.database!.from("books")
      .select("id, slug, author_id, title, subtitle, description, visibility, ai_enabled, comments_enabled, draft_document, current_version_id, updated_at")
      .eq("author_id", identity.id)
      .order("updated_at", { ascending: false });
    if (error) throw new Error("无法加载摄影书");
    const books: Photobook[] = (data ?? []).map((row: Record<string, unknown>) => {
      return {
        id: String(row.id),
        slug: String(row.slug),
        authorId: String(row.author_id),
        title: String(row.title),
        subtitle: String(row.subtitle || ""),
        author: identity.name,
        description: String(row.description || ""),
        status: row.visibility as Photobook["status"],
        aiEnabled: Boolean(row.ai_enabled),
        commentsEnabled: Boolean(row.comments_enabled),
        updatedAt: String(row.updated_at),
        document: row.draft_document as Photobook["document"],
      };
    });
    return NextResponse.json({ books });
  } catch (error) {
    return accessErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const identity = await requireIdentity(request);
    const input = schema.parse(await request.json().catch(() => ({})));
    const bookId = crypto.randomUUID();
    const slug = `book-${bookId.slice(0, 8)}`;
    if (identity.demo) {
      registerDemoBookOwner(bookId, identity.id, slug);
      return NextResponse.json({ id: bookId, slug, authorId: identity.id, title: input.title }, { status: 201 });
    }
    const { data, error } = await identity.database!.from("books").insert({
      id: bookId,
      author_id: identity.id,
      title: input.title,
      slug,
      visibility: "draft",
      ai_enabled: true,
      comments_enabled: true,
      draft_document: {
        version: 1,
        backgroundPolicy: "fixed-white",
        pages: [{ id: crypto.randomUUID(), name: "第 1 页", format: "4:3", width: 1440, height: 1080, background: "#ffffff", elements: [] }],
      },
    }).select("id, author_id, title").single();
    if (error) throw new Error("无法创建摄影书");
    return NextResponse.json({ id: data.id, slug, authorId: data.author_id, title: data.title }, { status: 201 });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
