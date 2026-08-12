import { describe, expect, it } from "vitest";
import { enforceWhitePagePolicy, validateWhitePagePolicy } from "@/lib/document-policy";
import { sampleBook } from "@/lib/sample-book";

describe("white page document policy", () => {
  it("accepts the fixed-white sample document", () => {
    expect(validateWhitePagePolicy(sampleBook.document)).toEqual({ valid: true });
  });

  it("rejects a colored page even if the rest of the document is valid", () => {
    const document = structuredClone(sampleBook.document);
    (document.pages[0] as { background: string }).background = "#f7efe0";
    expect(validateWhitePagePolicy(document)).toEqual(expect.objectContaining({ valid: false }));
  });

  it("normalizes every page back to pure white", () => {
    const document = structuredClone(sampleBook.document);
    (document.pages[1] as { background: string }).background = "transparent";
    expect(enforceWhitePagePolicy(document).pages.every((page) => page.background === "#ffffff")).toBe(true);
  });
});
