import { describe, expect, it } from "vitest";
import { POST } from "@/app/api/books/[id]/publish/route";
import { DEMO_AUTHOR, DEMO_READER, demoAuthHeaders } from "@/lib/demo-auth";
import { sampleBook } from "@/lib/sample-book";

function publishRequest(userId: string) {
  return new Request("http://localhost/api/books/book_demo/publish", {
    method: "POST",
    headers: { "content-type": "application/json", ...demoAuthHeaders(userId) },
    body: JSON.stringify({
      visibility: "public",
      aiEnabled: true,
      commentsEnabled: true,
      slug: sampleBook.slug,
      title: sampleBook.title,
      subtitle: sampleBook.subtitle,
      description: sampleBook.description,
      author: sampleBook.author,
      document: sampleBook.document,
    }),
  });
}

describe("publish ownership", () => {
  it("rejects a reader trying to publish another author's book", async () => {
    const response = await POST(publishRequest(DEMO_READER.id), { params: Promise.resolve({ id: sampleBook.id }) });
    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "只有作者可以修改这本摄影书" });
  });

  it("allows the verified author to publish", async () => {
    const response = await POST(publishRequest(DEMO_AUTHOR.id), { params: Promise.resolve({ id: sampleBook.id }) });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(expect.objectContaining({ bookId: sampleBook.id, visibility: "public" }));
  });
});
