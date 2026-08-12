"use client";

import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Copy, Globe2, Link2, Loader2, LockKeyhole, X } from "lucide-react";
import { useBookStore } from "@/store/book-store";
import { demoAuthHeaders } from "@/lib/demo-auth";

interface PublishDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onReadPublished: () => void;
}

export function PublishDialog({ open, onOpenChange, onReadPublished }: PublishDialogProps) {
  const { book, publish, setBookMeta } = useBookStore();
  const [visibility, setVisibility] = useState<"unlisted" | "public">(book.status === "public" ? "public" : "unlisted");
  const [pending, setPending] = useState(false);
  const [published, setPublished] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const publicUrl = typeof window === "undefined" ? `/read/${book.slug}` : `${window.location.origin}/?book=${book.slug}`;

  const submit = async () => {
    setPending(true);
    setError("");
    try {
      const response = await fetch(`/api/books/${book.id}/publish`, {
        method: "POST",
        headers: { "content-type": "application/json", ...demoAuthHeaders(book.authorId) },
        body: JSON.stringify({
          visibility,
          aiEnabled: book.aiEnabled,
          commentsEnabled: book.commentsEnabled,
          slug: book.slug,
          title: book.title,
          subtitle: book.subtitle,
          description: book.description,
          author: book.author,
          document: book.document,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "发布失败");
      publish(visibility, result.versionId);
      setPublished(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "发布失败");
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setPublished(false); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content publish-dialog">
          <header className="dialog-header">
            <div><Dialog.Title>{published ? "发布完成" : "发布摄影书"}</Dialog.Title><Dialog.Description>{published ? "公开版本已生成，不会包含之后的草稿修改。" : "发布会创建不可变快照，并重新建立公开检索索引。"}</Dialog.Description></div>
            <Dialog.Close aria-label="关闭"><X size={19} /></Dialog.Close>
          </header>

          {!published ? <>
            <div className="visibility-options">
              <button className={visibility === "unlisted" ? "active" : ""} onClick={() => setVisibility("unlisted")}>
                <span><Link2 size={20} /></span><div><strong>私密链接</strong><small>仅知道链接的人可以阅读</small></div>{visibility === "unlisted" && <Check size={17} />}
              </button>
              <button className={visibility === "public" ? "active" : ""} onClick={() => setVisibility("public")}>
                <span><Globe2 size={20} /></span><div><strong>公开作品</strong><small>进入作品广场，可被公开浏览</small></div>{visibility === "public" && <Check size={17} />}
              </button>
            </div>
            <label className="publish-toggle"><span><strong>允许浏览者问 AI</strong><small>浏览者需要邮箱验证；只能读取本次公开快照</small></span><input type="checkbox" checked={book.aiEnabled} onChange={(event) => setBookMeta({ aiEnabled: event.target.checked })} /></label>
            <label className="publish-toggle"><span><strong>允许浏览者评论</strong><small>评论只关联当前公开版本</small></span><input type="checkbox" checked={book.commentsEnabled} onChange={(event) => setBookMeta({ commentsEnabled: event.target.checked })} /></label>
            <div className="privacy-note"><LockKeyhole size={16} /><span>原图仍为私有；公开衍生图会移除 EXIF 与 GPS，仅显示你主动公开的地点。</span></div>
            {error && <div className="dialog-notice">{error}</div>}
            <button className="dialog-primary" onClick={() => void submit()} disabled={pending}>{pending ? <Loader2 className="spin" size={17} /> : <Globe2 size={17} />}发布当前版本</button>
          </> : <>
            <div className="published-check"><span><Check size={28} /></span><strong>{book.title}</strong><small>{visibility === "public" ? "已公开到作品广场" : "已创建私密阅读链接"}</small></div>
            <div className="share-link"><span>{publicUrl}</span><button aria-label="复制链接" onClick={async () => { await navigator.clipboard?.writeText(publicUrl); setCopied(true); }}><Copy size={16} />{copied ? "已复制" : "复制"}</button></div>
            <button className="dialog-primary" onClick={() => { onOpenChange(false); onReadPublished(); }}>打开公开版本</button>
          </>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
