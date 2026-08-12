import { describe, expect, it } from "vitest";
import { sanitizeSvg } from "@/lib/sanitize-svg";

describe("sanitizeSvg", () => {
  it("preserves simple vector decoration", () => {
    const clean = sanitizeSvg('<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="5" fill="#111" /></svg>');
    expect(clean).toContain("<circle");
  });

  it.each([
    '<svg><script>alert(1)</script></svg>',
    '<svg><image href="https://example.com/a.png" /></svg>',
    '<svg><rect onclick="alert(1)" /></svg>',
    '<svg><foreignObject><div>unsafe</div></foreignObject></svg>',
    '<svg><style>rect{fill:url(https://example.com/x)}</style></svg>',
  ])("rejects active or external content", (source) => {
    expect(() => sanitizeSvg(source)).toThrow();
  });
});
