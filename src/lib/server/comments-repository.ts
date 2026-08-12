import type { BookComment } from "@/types/book";

const demoComments: BookComment[] = [
  {
    id: "comment_demo_1",
    bookId: "book_demo",
    versionId: "version_demo_public",
    userId: "user_guest_mo",
    authorName: "墨禾",
    authorInitial: "墨",
    body: "第二页的留白和建筑阴影很有呼吸感。",
    pageNumber: 2,
    createdAt: "2026-08-03T09:20:00.000Z",
  },
];

export function listDemoComments(bookId: string, versionId: string, viewerId?: string) {
  return demoComments
    .filter((comment) => comment.bookId === bookId && comment.versionId === versionId)
    .map((comment) => ({ ...comment, canDelete: comment.userId === viewerId || viewerId === "user_lin" }))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function addDemoComment(input: Omit<BookComment, "id" | "createdAt" | "authorInitial">) {
  const comment: BookComment = {
    ...input,
    id: `comment_${crypto.randomUUID()}`,
    authorInitial: input.authorName.trim().slice(0, 1) || "读",
    createdAt: new Date().toISOString(),
    canDelete: true,
  };
  demoComments.push(comment);
  return comment;
}

export function deleteDemoComment(commentId: string, userId: string) {
  const index = demoComments.findIndex((comment) => comment.id === commentId);
  if (index < 0) return "missing" as const;
  if (demoComments[index].userId !== userId && userId !== "user_lin") return "forbidden" as const;
  demoComments.splice(index, 1);
  return "deleted" as const;
}
