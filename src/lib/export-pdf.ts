"use client";

import { PDFDocument } from "pdf-lib";
import { getFontFamilyCss } from "@/lib/fonts";
import { getInkPath } from "@/lib/ink";
import { getImageFilterCss, traceImageShape } from "@/lib/image-style";
import type { ImageElement, PatternElement, Photobook, SceneElement, ScenePage, TextElement } from "@/types/book";

const DPI_SCALE = 300 / 96;

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

function applyElementTransform(context: CanvasRenderingContext2D, element: SceneElement) {
  context.translate(element.x, element.y);
  context.rotate((element.rotation * Math.PI) / 180);
  context.globalAlpha = element.opacity;
}

async function drawImage(context: CanvasRenderingContext2D, element: ImageElement) {
  try {
    const image = await loadImage(element.src);
    context.save();
    traceImageShape(context, element.shape, element.width, element.height);
    context.clip();
    context.filter = getImageFilterCss(element.filter);

    const imageRatio = image.width / image.height;
    const frameRatio = element.width / element.height;
    let width = element.width;
    let height = element.height;
    let x = 0;
    let y = 0;

    if (element.fit === "contain") {
      if (imageRatio > frameRatio) {
        height = width / imageRatio;
        y = (element.height - height) / 2;
      } else {
        width = height * imageRatio;
        x = (element.width - width) / 2;
      }
    } else if (imageRatio > frameRatio) {
      width = element.height * imageRatio;
      x = (element.width - width) / 2;
    } else {
      height = element.width / imageRatio;
      y = (element.height - height) / 2;
    }

    context.drawImage(image, x, y, width, height);
    context.restore();
  } catch {
    context.fillStyle = "#f2f2f0";
    context.fillRect(0, 0, element.width, element.height);
  }
}

function drawPattern(context: CanvasRenderingContext2D, element: PatternElement) {
  const gap = Math.max(14, element.spacing * element.scale);
  context.save();
  context.beginPath();
  context.rect(0, 0, element.width, element.height);
  context.clip();
  if (element.background !== "transparent") {
    context.fillStyle = element.background;
    context.fillRect(0, 0, element.width, element.height);
  }
  context.strokeStyle = element.foreground;
  context.fillStyle = element.foreground;
  context.lineWidth = 2;

  if (element.pattern === "dots") {
    for (let y = 0; y <= element.height + gap; y += gap) {
      for (let x = 0; x <= element.width + gap; x += gap) {
        context.beginPath();
        context.arc(x, y, gap * 0.12, 0, Math.PI * 2);
        context.fill();
      }
    }
  }

  if (element.pattern === "grid") {
    for (let x = 0; x <= element.width; x += gap) {
      context.beginPath();
      context.moveTo(x, 0);
      context.lineTo(x, element.height);
      context.stroke();
    }
    for (let y = 0; y <= element.height; y += gap) {
      context.beginPath();
      context.moveTo(0, y);
      context.lineTo(element.width, y);
      context.stroke();
    }
  }

  if (element.pattern === "stripes") {
    context.lineWidth = Math.max(3, gap * 0.16);
    for (let x = -element.height; x <= element.width; x += gap) {
      context.beginPath();
      context.moveTo(x, element.height);
      context.lineTo(x + element.height, 0);
      context.stroke();
    }
  }

  if (element.pattern === "checker") {
    for (let y = 0, row = 0; y <= element.height; y += gap, row += 1) {
      for (let x = 0, column = 0; x <= element.width; x += gap, column += 1) {
        if ((row + column) % 2 === 0) context.fillRect(x, y, gap, gap);
      }
    }
  }

  if (element.pattern === "waves") {
    for (let y = 0; y <= element.height; y += gap) {
      context.beginPath();
      for (let x = 0; x <= element.width + gap; x += gap / 5) {
        const waveY = y + Math.sin((x / gap) * Math.PI * 2) * gap * 0.15;
        if (x === 0) context.moveTo(x, waveY);
        else context.lineTo(x, waveY);
      }
      context.stroke();
    }
  }

  if (element.pattern === "frame") {
    context.lineWidth = 3;
    context.strokeRect(3, 3, element.width - 6, element.height - 6);
  }
  context.restore();
}

function drawText(context: CanvasRenderingContext2D, element: TextElement) {
  const family = getFontFamilyCss(element.fontFamily);
  context.fillStyle = element.color;
  context.font = `${element.fontWeight} ${element.fontSize}px ${family}`;
  context.textAlign = element.align;
  context.textBaseline = "top";
  const anchor = element.align === "center" ? element.width / 2 : element.align === "right" ? element.width : 0;
  const lineHeight = element.fontSize * element.lineHeight;
  const paragraphs = element.text.split("\n");
  let y = 0;

  for (const paragraph of paragraphs) {
    let line = "";
    for (const character of paragraph) {
      const test = line + character;
      if (line && context.measureText(test).width > element.width) {
        context.fillText(line, anchor, y, element.width);
        line = character;
        y += lineHeight;
      } else {
        line = test;
      }
      if (y > element.height) return;
    }
    context.fillText(line, anchor, y, element.width);
    y += lineHeight;
  }
}

export async function renderScenePage(page: ScenePage, maxSide = 3000) {
  await document.fonts?.ready;
  const renderScale = Math.min(DPI_SCALE, maxSide / Math.max(page.width, page.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(page.width * renderScale);
  canvas.height = Math.round(page.height * renderScale);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建导出画布");
  context.scale(renderScale, renderScale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, page.width, page.height);

  for (const element of page.elements) {
    context.save();
    applyElementTransform(context, element);
    if (element.type === "image") await drawImage(context, element);
    if (element.type === "text") drawText(context, element);
    if (element.type === "pattern") drawPattern(context, element);
    if (element.type === "ink") {
      for (const stroke of element.strokes) {
        const path = new Path2D(getInkPath(stroke.points, stroke.size));
        context.globalAlpha = element.opacity * stroke.opacity;
        context.fillStyle = stroke.color;
        context.fill(path);
      }
    }
    context.restore();
  }
  return canvas;
}

export function safeFilename(title: string) {
  return title.replace(/[\\/:*?"<>|]/g, "-").trim() || "摄影书";
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("无法创建图片文件")), type, quality);
  });
}

export async function exportScenePageImage(book: Photobook, page: ScenePage, pageIndex: number, format: "png" | "jpeg") {
  const canvas = await renderScenePage(page);
  const mime = format === "png" ? "image/png" : "image/jpeg";
  const blob = await canvasToBlob(canvas, mime, format === "jpeg" ? 0.94 : undefined);
  downloadBlob(blob, `${safeFilename(book.title)}-第${pageIndex + 1}页.${format === "jpeg" ? "jpg" : "png"}`);
}

export async function exportPhotobookPdf(book: Photobook, onProgress?: (current: number, total: number) => void) {
  const pdf = await PDFDocument.create();
  const pages = book.document.pages;
  for (let index = 0; index < pages.length; index += 1) {
    onProgress?.(index + 1, pages.length);
    const scenePage = pages[index];
    const canvas = await renderScenePage(scenePage);
    const dataUrl = canvas.toDataURL("image/png");
    const image = await pdf.embedPng(dataUrl);
    const longSide = 842;
    const ratio = scenePage.width / scenePage.height;
    const width = ratio >= 1 ? longSide : longSide * ratio;
    const height = ratio >= 1 ? longSide / ratio : longSide;
    const page = pdf.addPage([width, height]);
    page.drawImage(image, { x: 0, y: 0, width, height });
  }
  pdf.setTitle(book.title);
  pdf.setAuthor(book.author);
  const bytes = await pdf.save();
  const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
  downloadBlob(blob, `${safeFilename(book.title)}.pdf`);
}
