"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, LogIn, MessageCircle, Send, Trash2, X } from "lucide-react";
import { DEMO_OTP, DEMO_READER, demoAuthHeaders } from "@/lib/demo-auth";
import type { BookComment, Photobook } from "@/types/book";

interface CommentsPanelProps {
  open: boolean;
  onClose: () => void;
  book: Photobook;
  pageNumber: number;
  onCountChange?: (count: number) => void;
}

const SESSION_KEY = "white-page-demo-login-v2";

export function CommentsPanel({ open, onClose, book, pageNumber, onCountChange }: CommentsPanelProps) {
  const [comments, setComments] = useState<BookComment[]>([]);
  const [body, setBody] = useState("");
  const [attachPage, setAttachPage] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  const versionId = book.publishedSnapshot?.id;

  useEffect(() => {
    setLoggedIn(localStorage.getItem(SESSION_KEY) === "true");
  }, []);

  useEffect(() => {
    if (!open || !versionId) return;
    let active = true;
    setLoading(true);
    fetch(`/api/public/books/${book.slug}/comments`, {
      headers: loggedIn ? demoAuthHeaders(DEMO_READER.id) : undefined,
    })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "无法加载评论");
        if (active) {
          setComments(result.comments);
        }
      })
      .catch((requestError) => active && setError(requestError instanceof Error ? requestError.message : "无法加载评论"))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [book.slug, loggedIn, onCountChange, open, versionId]);

  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments, open]);

  useEffect(() => {
    onCountChange?.(comments.length);
  }, [comments.length, onCountChange]);

  if (!open) return null;

  const requestCode = () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) return setError("请输入有效邮箱");
    setOtpSent(true);
    setError("");
  };

  const verify = () => {
    if (otp !== DEMO_OTP) return setError("验证码不正确");
    localStorage.setItem(SESSION_KEY, "true");
    setLoggedIn(true);
    setError("");
  };

  const submit = async () => {
    const text = body.trim();
    if (!text || !versionId || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch(`/api/public/books/${book.slug}/comments`, {
        method: "POST",
        headers: { "content-type": "application/json", ...demoAuthHeaders(DEMO_READER.id) },
        body: JSON.stringify({ body: text, versionId, pageNumber: attachPage ? pageNumber : undefined }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "评论发布失败");
      setComments((current) => [...current, result.comment]);
      setBody("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "评论发布失败");
    } finally {
      setSending(false);
    }
  };

  const remove = async (commentId: string) => {
    const response = await fetch(`/api/comments/${commentId}`, { method: "DELETE", headers: demoAuthHeaders(DEMO_READER.id) });
    if (!response.ok) return setError("无法删除评论");
    setComments((current) => current.filter((comment) => comment.id !== commentId));
  };

  return <>
    <button className="comments-backdrop" onClick={onClose} aria-label="关闭评论" />
    <aside className="comments-panel" aria-label="摄影书评论">
      <header className="comments-header">
        <div><span><MessageCircle size={17} /></span><div><strong>评论</strong><small>{comments.length} 条 · 公开版本</small></div></div>
        <button onClick={onClose} aria-label="关闭"><X size={20} /></button>
      </header>

      <div className="comments-list">
        {loading && <div className="comments-loading"><Loader2 className="spin" size={18} />加载评论</div>}
        {!loading && !comments.length && <div className="comments-empty"><MessageCircle size={24} /><strong>还没有评论</strong><span>留下第一条读后感。</span></div>}
        {comments.map((comment) => <article className="comment-item" key={comment.id}>
          <span className="comment-avatar">{comment.authorInitial}</span>
          <div>
            <header><strong>{comment.authorName}</strong><time>{new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(new Date(comment.createdAt))}</time>{comment.canDelete && <button onClick={() => void remove(comment.id)} aria-label="删除评论"><Trash2 size={13} /></button>}</header>
            <p>{comment.body}</p>
            {comment.pageNumber && <button className="comment-page-reference">第 {comment.pageNumber} 页</button>}
          </div>
        </article>)}
        <div ref={endRef} />
      </div>

      {!loggedIn ? <div className="comments-login">
        <span><LogIn size={21} /></span><h2>登录后发表评论</h2>
        {!otpSent ? <><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /><button onClick={requestCode}>发送验证码</button></> : <><input inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="六位验证码" /><button onClick={verify}>验证并登录</button><small>本地演示验证码：{DEMO_OTP}</small></>}
        {error && <p>{error}</p>}
      </div> : <div className="comments-composer">
        <textarea maxLength={500} rows={3} value={body} onChange={(event) => setBody(event.target.value)} placeholder="写下你的评论…" />
        <div><label><input type="checkbox" checked={attachPage} onChange={(event) => setAttachPage(event.target.checked)} />关联第 {pageNumber} 页</label><span>{body.length}/500</span><button onClick={() => void submit()} disabled={!body.trim() || sending} aria-label="发布评论">{sending ? <Loader2 className="spin" size={16} /> : <Send size={16} />}</button></div>
        {error && <p>{error}</p>}
      </div>}
    </aside>
  </>;
}
