import type { ImageFilter, ImageShape } from "@/types/book";

interface ShapePathContext {
  beginPath: () => void;
  closePath: () => void;
  rect: (x: number, y: number, width: number, height: number) => void;
  roundRect: (x: number, y: number, width: number, height: number, radii: number) => void;
  ellipse: (x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number) => void;
  moveTo: (x: number, y: number) => void;
  lineTo: (x: number, y: number) => void;
  quadraticCurveTo: (cpx: number, cpy: number, x: number, y: number) => void;
}

export function traceImageShape(context: ShapePathContext, shape: ImageShape | undefined, width: number, height: number) {
  context.beginPath();
  if (shape === "rounded") {
    context.roundRect(0, 0, width, height, Math.min(width, height) * 0.1);
  } else if (shape === "circle") {
    context.ellipse(width / 2, height / 2, width / 2, height / 2, 0, 0, Math.PI * 2);
  } else if (shape === "arch") {
    const shoulder = Math.min(height * 0.5, width * 0.5);
    context.moveTo(0, height);
    context.lineTo(0, shoulder);
    context.quadraticCurveTo(width / 2, -shoulder, width, shoulder);
    context.lineTo(width, height);
    context.closePath();
  } else {
    context.rect(0, 0, width, height);
  }
}

export function getImageFilterCss(filter: ImageFilter | undefined) {
  if (filter === "grayscale") return "grayscale(1)";
  if (filter === "sepia") return "sepia(0.82) saturate(0.78) contrast(1.06)";
  if (filter === "blur") return "blur(10px)";
  if (filter === "contrast") return "contrast(1.28) saturate(0.82)";
  return "none";
}
