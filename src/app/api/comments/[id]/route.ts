import { NextResponse } from "next/server";
import { deleteDemoComment } from "@/lib/server/comments-repository";
import { AccessError, accessErrorResponse, requireIdentity } from "@/lib/server/request-auth";

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const identity = await requireIdentity(request);
    if (identity.demo) {
      const result = deleteDemoComment(id, identity.id);
      if (result === "missing") return NextResponse.json({ error: "评论不存在" }, { status: 404 });
      if (result === "forbidden") throw new AccessError("只能删除自己的评论", 403);
      return new NextResponse(null, { status: 204 });
    }

    const { data: comment } = await identity.database!.from("book_comments")
      .select("id, user_id, book_id")
      .eq("id", id)
      .maybeSingle();
    if (!comment) return NextResponse.json({ error: "评论不存在" }, { status: 404 });
    const { data: book } = await identity.database!.from("books").select("author_id").eq("id", comment.book_id).single();
    if (comment.user_id !== identity.id && book?.author_id !== identity.id) throw new AccessError("只能删除自己的评论", 403);
    const { error } = await identity.database!.from("book_comments").delete().eq("id", id);
    if (error) throw new Error("无法删除评论");
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return accessErrorResponse(error);
  }
}
