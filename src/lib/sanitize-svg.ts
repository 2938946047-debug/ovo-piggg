import sanitizeHtml from "sanitize-html";

const allowedTags = [
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon", "defs", "linearGradient", "radialGradient", "stop", "clipPath", "mask", "title", "desc",
];

const allowedAttributes = {
  svg: ["xmlns", "viewBox", "width", "height", "fill", "stroke", "preserveAspectRatio"],
  "*": ["id", "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "points", "fill", "fill-opacity", "fill-rule", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin", "stroke-opacity", "opacity", "transform", "viewBox", "offset", "stop-color", "stop-opacity", "clip-path", "mask"],
};

export function sanitizeSvg(source: string): string {
  if (!source.trim().startsWith("<svg") && !source.includes("<svg")) throw new Error("文件不是有效 SVG");
  if (/<!DOCTYPE|<!ENTITY|<foreignObject|<script|\bon\w+\s*=|(?:href|src)\s*=|url\s*\(\s*['\"]?(?:https?:|data:|\/\/)/i.test(source)) {
    throw new Error("SVG 包含脚本、外链或不安全内容");
  }
  const clean = sanitizeHtml(source, {
    allowedTags,
    allowedAttributes,
    allowVulnerableTags: false,
    disallowedTagsMode: "discard",
    parser: { lowerCaseTags: false, lowerCaseAttributeNames: false },
    allowedSchemes: [],
  });
  if (!clean.includes("<svg")) throw new Error("SVG 清洗后没有可用内容");
  return clean;
}
