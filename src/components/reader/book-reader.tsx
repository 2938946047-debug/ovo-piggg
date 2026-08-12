"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Bot, ChevronLeft, ChevronRight, Images, Maximize2, MapPin, MessageCircle } from "lucide-react";
import { AIAssistant } from "@/components/ai/ai-assistant";
import { CommentsPanel } from "@/components/comments/comments-panel";
import EditorCanvas from "@/components/editor/editor-canvas";
import { useBookStore } from "@/store/book-store";
import type { ImageElement } from "@/types/book";

interface BookReaderProps {
  publishedOnly?: boolean;
  onBack: () => void;
  onGallery: () => void;
}

export function BookReader({ publishedOnly = false, onBack, onGallery }: BookReaderProps) {
  const book = useBookStore((state) => state.book);
  const sceneDocument = publishedOnly && book.publishedSnapshot ? book.publishedSnapshot.document : book.document;
  const [pageIndex, setPageIndex] = useState(0);
  const [aiOpen, setAiOpen] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [focusImage, setFocusImage] = useState<ImageElement | null>(null);
  const page = sceneDocument.pages[Math.min(pageIndex, sceneDocument.pages.length - 1)];
  const visibleLocation = useMemo(() => {
    const image = page.elements.find((element): element is ImageElement => element.type === "image" && !element.decorative && Boolean(element.location));
    if (!image?.location || image.location.visibility === "hidden") return "";
    return image.location.visibility === "exact" ? image.location.exactLabel || image.location.city || "" : image.location.city || "";
  }, [page]);

  const go = (direction: number) => setPageIndex((current) => Math.max(0, Math.min(sceneDocument.pages.length - 1, current + direction)));

  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
      if (event.key === "Escape") { setAiOpen(false); setCommentsOpen(false); }
    };
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });

  return (
    <main className="reader-shell">
      <header className="reader-header">
        <button className="reader-icon-button" onClick={onBack} aria-label="返回"><ArrowLeft size={20} /></button>
        <div className="reader-book-meta"><strong>{book.title}</strong><span>{book.author}</span></div>
        {publishedOnly && <span className="reader-mode-label">公开版本 · 只读</span>}
        <div className="reader-header-spacer" />
        {publishedOnly && <button className="reader-text-button" onClick={onGallery} aria-label="作品广场"><Images size={17} /><span>作品广场</span></button>}
        <button className="reader-icon-button" onClick={() => document.documentElement.requestFullscreen?.()} aria-label="全屏阅读"><Maximize2 size={19} /></button>
        {publishedOnly && book.commentsEnabled && <button className="reader-comment-button" aria-label="查看评论" onClick={() => { setAiOpen(false); setCommentsOpen(true); }}><MessageCircle size={18} /><span>评论{commentCount > 0 ? ` ${commentCount}` : ""}</span></button>}
        {book.aiEnabled && <button className="reader-ai-button" aria-label="问问 AI" onClick={() => { setCommentsOpen(false); setFocusImage(null); setAiOpen(true); }}><Bot size={18} /><span>问问 AI</span></button>}
      </header>

      <section className="reader-stage" aria-label={`第 ${pageIndex + 1} 页`}>
        <button className="reader-arrow previous" onClick={() => go(-1)} disabled={pageIndex === 0} aria-label="上一页"><ChevronLeft size={25} /></button>
        <div className="reader-canvas-wrap">
          <div key={page.id} className={`reader-page-motion reader-transition-${page.transition ?? "fade"}`} data-transition={page.transition ?? "fade"}>
            <EditorCanvas page={page} readOnly maxHeight={820} onImageFocus={(image) => { setCommentsOpen(false); setFocusImage(image); setAiOpen(true); }} />
            {visibleLocation && <span className="reader-location"><MapPin size={13} />{visibleLocation}</span>}
          </div>
        </div>
        <button className="reader-arrow next" onClick={() => go(1)} disabled={pageIndex === sceneDocument.pages.length - 1} aria-label="下一页"><ChevronRight size={25} /></button>
      </section>

      <footer className="reader-footer">
        <span>{String(pageIndex + 1).padStart(2, "0")} / {String(sceneDocument.pages.length).padStart(2, "0")}</span>
        <div className="reader-page-track">
          {sceneDocument.pages.map((item, index) => <button key={item.id} className={pageIndex === index ? "active" : ""} onClick={() => setPageIndex(index)} aria-label={`第 ${index + 1} 页`} />)}
        </div>
        <span>{page.name}</span>
      </footer>

      <AIAssistant open={aiOpen} onClose={() => setAiOpen(false)} viewerMode={publishedOnly} pageId={page.id} focusImage={focusImage} />
      {publishedOnly && book.publishedSnapshot && <CommentsPanel open={commentsOpen} onClose={() => setCommentsOpen(false)} book={book} pageNumber={pageIndex + 1} onCountChange={setCommentCount} />}
    </main>
  );
}
