"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, FileImage, FileText, Film, Loader2, X } from "lucide-react";
import { exportPhotobookPdf, exportScenePageImage } from "@/lib/export-pdf";
import { exportPhotobookVideo } from "@/lib/export-video";
import { useBookStore } from "@/store/book-store";

interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const book = useBookStore((state) => state.book);
  const activePageId = useBookStore((state) => state.activePageId);
  const [status, setStatus] = useState<"idle" | "image" | "pdf" | "video" | "done">("idle");
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState("");
  const [imageFormat, setImageFormat] = useState<"png" | "jpeg">("png");
  const [secondsPerPage, setSecondsPerPage] = useState(5);
  const busy = status === "image" || status === "pdf" || status === "video";
  const activePageIndex = Math.max(0, book.document.pages.findIndex((page) => page.id === activePageId));

  const exportImage = async () => {
    setStatus("image");
    setMessage("");
    try {
      await exportScenePageImage(book, book.document.pages[activePageIndex], activePageIndex, imageFormat);
      setStatus("done");
      setMessage(`第 ${activePageIndex + 1} 页图片已开始下载`);
    } catch (error) {
      setStatus("idle");
      setMessage(error instanceof Error ? error.message : "图片生成失败，请稍后重试");
    }
  };

  const exportPdf = async () => {
    setStatus("pdf");
    setMessage("");
    try {
      await exportPhotobookPdf(book, (current, total) => setProgress(Math.round((current / total) * 100)));
      setStatus("done");
      setMessage("PDF 已生成并开始下载");
    } catch {
      setStatus("idle");
      setMessage("PDF 生成失败，请稍后重试");
    }
  };

  const exportVideo = async () => {
    setStatus("video");
    setMessage("");
    setProgress(0);
    try {
      const format = await exportPhotobookVideo(book, {
        secondsPerPage,
        transitionSeconds: 0.5,
        onProgress: setProgress,
      });
      setMessage(`${format} 完整视频已开始下载`);
      setStatus("done");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "视频生成失败，请稍后重试");
      setStatus("idle");
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content export-dialog">
          <header className="dialog-header">
            <div><Dialog.Title>导出摄影书</Dialog.Title><Dialog.Description>所有留白均保持纯白，元素位置按页面比例输出。</Dialog.Description></div>
            <Dialog.Close aria-label="关闭"><X size={19} /></Dialog.Close>
          </header>

          <div className="export-options">
            <button onClick={() => void exportImage()} disabled={busy} aria-label="导出当前页图片">
              <span className="export-icon"><FileImage size={22} /></span>
              <span><strong>当前页图片</strong><small>第 {activePageIndex + 1} 页 · {imageFormat === "png" ? "PNG 无损" : "JPEG 高质量"}</small></span>
              {status === "image" ? <Loader2 className="spin" size={18} /> : <span className="export-action">下载</span>}
            </button>
            <button onClick={() => void exportPdf()} disabled={busy}>
              <span className="export-icon"><FileText size={22} /></span>
              <span><strong>PDF 文档</strong><small>300 DPI · 保留每页独立比例</small></span>
              {status === "pdf" ? <Loader2 className="spin" size={18} /> : <span className="export-action">下载</span>}
            </button>
            <button onClick={() => void exportVideo()} disabled={busy} aria-label="导出完整视频">
              <span className="export-icon"><Film size={22} /></span>
              <span><strong>完整翻页视频</strong><small>1920×1080 · 使用逐页转场 · 无音乐</small></span>
              {status === "video" ? <Loader2 className="spin" size={18} /> : <span className="export-action">创建</span>}
            </button>
          </div>

          <div className="export-settings">
            <label><span>单页格式</span><select value={imageFormat} onChange={(event) => setImageFormat(event.target.value as "png" | "jpeg")}><option value="png">PNG</option><option value="jpeg">JPEG</option></select></label>
            <label><span>每页时长</span><select value={secondsPerPage} onChange={(event) => setSecondsPerPage(Number(event.target.value))}><option value="2">2 秒</option><option value="3">3 秒</option><option value="5">5 秒</option><option value="8">8 秒</option></select></label>
          </div>
          {(status === "pdf" || status === "video") && <div className="export-progress" aria-label={`导出进度 ${progress}%`}><span style={{ width: `${progress}%` }} /></div>}
          {message && <div className={`dialog-notice ${status === "done" ? "success" : ""}`}>{status === "done" && <Check size={15} />}{message}</div>}
          <p className="dialog-footnote">视频在设备本地合成，优先 MP4，不支持时自动导出 WebM。AI 问答不会嵌入导出文件。</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
