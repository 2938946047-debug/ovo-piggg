import { describe, expect, it } from "vitest";
import { canCommentOnBook, canEditBook, canReadBook } from "@/lib/access-control";
import { sampleBook } from "@/lib/sample-book";

describe("photobook access control", () => {
  it("allows only the author to edit", () => {
    expect(canEditBook(sampleBook, sampleBook.authorId)).toBe(true);
    expect(canEditBook(sampleBook, "another-user")).toBe(false);
    expect(canEditBook(sampleBook, null)).toBe(false);
  });

  it("allows public reading without granting edit access", () => {
    const published = { ...sampleBook, status: "public" as const };
    expect(canReadBook(published, null)).toBe(true);
    expect(canEditBook(published, "reader-user")).toBe(false);
  });

  it("requires a login, a published snapshot, and the comments switch", () => {
    const published = { ...sampleBook, status: "public" as const };
    expect(canCommentOnBook(published, "reader-user")).toBe(true);
    expect(canCommentOnBook(published, null)).toBe(false);
    expect(canCommentOnBook({ ...published, commentsEnabled: false }, "reader-user")).toBe(false);
  });
});
