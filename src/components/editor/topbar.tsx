"use client";

import { Bot, Check, ChevronDown, Download, Eye, Redo2, Share2, Undo2 } from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { useBookStore } from "@/store/book-store";

interface TopbarProps {
  onDashboard: () => void;
  onPreview: () => void;
  onAI: () => void;
  onPublish: () => void;
  onExport: () => void;
  authorName: string;
  aiAvailable: boolean;
}

export function Topbar({ onDashboard, onPreview, onAI, onPublish, onExport, authorName, aiAvailable }: TopbarProps) {
  const { book, savedAt, past, future, undo, redo, setBookMeta } = useBookStore();
  return (
    <header className="topbar">
      <button className="brand-block" onClick={onDashboard} aria-label="返回作品控制台"><span className="brand-mark" aria-hidden="true" /><strong>白页</strong><span className="brand-divider" /></button>
      <input className="book-title-input" value={book.title} onChange={(event) => setBookMeta({ title: event.target.value })} aria-label="摄影书标题" />
      <div className="save-status"><Check size={14} /><span>已自动保存</span><time>{new Date(savedAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</time></div>
      <div className="topbar-spacer" />
      <div className="topbar-group compact">
        <IconButton label="撤销" icon={<Undo2 size={18} />} onClick={undo} disabled={!past.length} />
        <IconButton label="重做" icon={<Redo2 size={18} />} onClick={redo} disabled={!future.length} />
      </div>
      <div className="topbar-group">
        <button className="text-button" onClick={onExport} aria-label="导出"><Download size={17} /><span>导出</span></button>
        <button className="text-button" onClick={onPreview} aria-label="预览"><Eye size={17} /><span>预览</span></button>
        {aiAvailable && <button className="ai-button" onClick={onAI} aria-label="问问 AI"><Bot size={18} /><span>问问 AI</span></button>}
        <button className="publish-button" onClick={onPublish}><Share2 size={17} />发布<ChevronDown size={14} /></button>
      </div>
      <button className="avatar-button" aria-label={`账户：${authorName}`}>{authorName.slice(0, 1)}</button>
    </header>
  );
}
