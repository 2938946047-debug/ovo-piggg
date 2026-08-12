import type { Photobook } from "@/types/book";

export function canEditBook(book: Pick<Photobook, "authorId">, userId: string | null | undefined) {
  return Boolean(userId && book.authorId === userId);
}

export function canReadBook(book: Pick<Photobook, "authorId" | "status">, userId: string | null | undefined) {
  return book.status === "public" || book.status === "unlisted" || canEditBook(book, userId);
}

export function canCommentOnBook(
  book: Pick<Photobook, "status" | "commentsEnabled" | "publishedSnapshot">,
  userId: string | null | undefined,
) {
  return Boolean(userId && book.commentsEnabled && book.publishedSnapshot && book.status !== "draft");
}
