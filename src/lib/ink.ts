import { getStroke } from "perfect-freehand";
import type { InkPoint, InkStroke } from "@/types/book";

export function getInkPath(points: InkPoint[], size: number): string {
  if (points.length < 2) return "";
  const outline = getStroke(
    points.map((point) => [point.x, point.y, point.pressure] as [number, number, number]),
    {
      size,
      thinning: 0.68,
      smoothing: 0.62,
      streamline: 0.55,
      simulatePressure: points.every((point) => point.pressure === 0.5),
      easing: (value) => value,
      start: { taper: true, cap: true },
      end: { taper: true, cap: true },
    },
  );
  if (!outline.length) return "";
  const average = (a: number[], b: number[]) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  let path = `M${outline[0][0].toFixed(2)},${outline[0][1].toFixed(2)} Q`;
  for (let index = 1; index < outline.length; index += 1) {
    const midpoint = average(outline[index - 1], outline[index]);
    path += `${outline[index - 1][0].toFixed(2)},${outline[index - 1][1].toFixed(2)} ${midpoint[0].toFixed(2)},${midpoint[1].toFixed(2)} `;
  }
  path += "Z";
  return path;
}

export function eraseStrokesAt(strokes: InkStroke[], x: number, y: number, radius: number): InkStroke[] {
  const next: InkStroke[] = [];
  for (const stroke of strokes) {
    let segment: InkPoint[] = [];
    for (const point of stroke.points) {
      const outside = Math.hypot(point.x - x, point.y - y) > radius;
      if (outside) {
        segment.push(point);
      } else if (segment.length > 1) {
        next.push({ ...stroke, id: `${stroke.id}_${next.length}`, points: segment });
        segment = [];
      } else {
        segment = [];
      }
    }
    if (segment.length > 1) next.push({ ...stroke, id: `${stroke.id}_${next.length}`, points: segment });
  }
  return next;
}
