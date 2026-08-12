import { describe, expect, it, vi } from "vitest";
import { getImageFilterCss, traceImageShape } from "@/lib/image-style";

describe("image styles", () => {
  it("maps every persisted filter to an export filter", () => {
    expect(getImageFilterCss("none")).toBe("none");
    expect(getImageFilterCss("grayscale")).toContain("grayscale");
    expect(getImageFilterCss("sepia")).toContain("sepia");
    expect(getImageFilterCss("blur")).toContain("blur");
    expect(getImageFilterCss("contrast")).toContain("contrast");
  });

  it("traces a closed arch instead of a rectangular frame", () => {
    const context = {
      beginPath: vi.fn(),
      closePath: vi.fn(),
      rect: vi.fn(),
      roundRect: vi.fn(),
      ellipse: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      quadraticCurveTo: vi.fn(),
    };
    traceImageShape(context, "arch", 400, 600);
    expect(context.quadraticCurveTo).toHaveBeenCalledWith(200, -200, 400, 200);
    expect(context.closePath).toHaveBeenCalledOnce();
    expect(context.rect).not.toHaveBeenCalled();
  });
});
