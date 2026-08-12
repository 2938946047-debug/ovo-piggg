"use client";

import { renderScenePage, safeFilename } from "@/lib/export-pdf";
import type { PageTransition, Photobook } from "@/types/book";

export interface VideoExportOptions {
  secondsPerPage: number;
  transitionSeconds?: number;
  onProgress?: (progress: number) => void;
}

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function supportedVideoType() {
  const candidates = [
    "video/mp4;codecs=avc1.42E01E",
    "video/mp4",
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function drawLetterboxed(context: CanvasRenderingContext2D, source: HTMLCanvasElement, x = 0, opacity = 1, scale = 1, clipWidth?: number) {
  const frameWidth = context.canvas.width;
  const frameHeight = context.canvas.height;
  const ratio = Math.min(frameWidth / source.width, frameHeight / source.height) * scale;
  const width = source.width * ratio;
  const height = source.height * ratio;
  const left = (frameWidth - width) / 2 + x;
  const top = (frameHeight - height) / 2;
  context.save();
  context.globalAlpha = opacity;
  if (clipWidth !== undefined) {
    context.beginPath();
    context.rect(0, 0, clipWidth, frameHeight);
    context.clip();
  }
  context.drawImage(source, left, top, width, height);
  context.restore();
}

function drawFrame(context: CanvasRenderingContext2D, current: HTMLCanvasElement, next: HTMLCanvasElement | undefined, transition: PageTransition, progress: number) {
  const width = context.canvas.width;
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, context.canvas.height);
  if (!next || progress <= 0) {
    drawLetterboxed(context, current);
    return;
  }
  if (transition === "none") {
    drawLetterboxed(context, progress < 1 ? current : next);
    return;
  }
  if (transition === "slide-left") {
    drawLetterboxed(context, current, -width * progress);
    drawLetterboxed(context, next, width * (1 - progress));
    return;
  }
  drawLetterboxed(context, current, 0, transition === "fade" || transition === "zoom" ? 1 - progress : 1, transition === "zoom" ? 1 + progress * 0.04 : 1);
  if (transition === "wipe") drawLetterboxed(context, next, 0, 1, 1, width * progress);
  else drawLetterboxed(context, next, 0, progress);
}

function downloadVideo(blob: Blob, title: string, mimeType: string) {
  const extension = mimeType.startsWith("video/mp4") ? "mp4" : "webm";
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFilename(title)}.${extension}`;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
  return extension.toUpperCase();
}

export async function exportPhotobookVideo(book: Photobook, options: VideoExportOptions) {
  if (typeof MediaRecorder === "undefined" || !HTMLCanvasElement.prototype.captureStream) {
    throw new Error("当前浏览器不支持本地视频合成，请改用最新版 Chrome、Edge 或 Safari");
  }
  const mimeType = supportedVideoType();
  if (!mimeType) throw new Error("当前浏览器没有可用的视频编码器");

  const pageCanvases: HTMLCanvasElement[] = [];
  for (let index = 0; index < book.document.pages.length; index += 1) {
    pageCanvases.push(await renderScenePage(book.document.pages[index], 1920));
    options.onProgress?.(Math.round(((index + 1) / book.document.pages.length) * 15));
  }

  const canvas = document.createElement("canvas");
  canvas.width = 1920;
  canvas.height = 1080;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("无法创建视频画布");
  const stream = canvas.captureStream(30);
  const chunks: BlobPart[] = [];
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  recorder.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
  const stopped = new Promise<void>((resolve, reject) => {
    recorder.onstop = () => resolve();
    recorder.onerror = () => reject(new Error("视频编码失败"));
  });
  const pageMilliseconds = Math.max(1, options.secondsPerPage) * 1_000;
  const transitionMilliseconds = Math.min(pageMilliseconds * 0.4, Math.max(0, options.transitionSeconds ?? 0.5) * 1_000);

  try {
    recorder.start(1_000);
    for (let index = 0; index < pageCanvases.length; index += 1) {
      const current = pageCanvases[index];
      const next = pageCanvases[index + 1];
      const holdMilliseconds = next ? pageMilliseconds - transitionMilliseconds : pageMilliseconds;
      drawFrame(context, current, undefined, "none", 0);
      const holdStarted = performance.now();
      while (performance.now() - holdStarted < holdMilliseconds) {
        const elapsed = performance.now() - holdStarted;
        const overall = (index * pageMilliseconds + elapsed) / (pageCanvases.length * pageMilliseconds);
        options.onProgress?.(15 + Math.round(overall * 80));
        await wait(100);
      }
      if (next && transitionMilliseconds > 0) {
        const transitionStarted = performance.now();
        while (performance.now() - transitionStarted < transitionMilliseconds) {
          const progress = Math.min(1, (performance.now() - transitionStarted) / transitionMilliseconds);
          drawFrame(context, current, next, book.document.pages[index + 1].transition ?? "fade", progress);
          await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        }
      }
    }
    recorder.stop();
    await stopped;
  } finally {
    stream.getTracks().forEach((track) => track.stop());
  }

  const blob = new Blob(chunks, { type: mimeType });
  if (!blob.size) throw new Error("视频文件为空，请重新导出");
  options.onProgress?.(100);
  return downloadVideo(blob, book.title, mimeType);
}
