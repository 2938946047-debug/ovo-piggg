"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, Bot, Check, ExternalLink, Image as ImageIcon, LogIn, MapPin, Sparkles, X } from "lucide-react";
import { createId } from "@/lib/ids";
import { DEMO_AUTHOR, DEMO_READER, demoAuthHeaders } from "@/lib/demo-auth";
import { useBookStore } from "@/store/book-store";
import type { AIMessage, ImageElement } from "@/types/book";

interface AIAssistantProps {
  open: boolean;
  onClose: () => void;
  viewerMode?: boolean;
  pageId?: string;
  focusImage?: ImageElement | null;
}

export function AIAssistant({ open, onClose, viewerMode = false, pageId, focusImage }: AIAssistantProps) {
  const { book, activePageId } = useBookStore();
  const currentPageId = pageId ?? activePageId;
  const document = viewerMode && book.publishedSnapshot ? book.publishedSnapshot.document : book.document;
  const page = document.pages.find((item) => item.id === currentPageId) ?? document.pages[0];
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(!viewerMode);
  const [email, setEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [includeExact, setIncludeExact] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!viewerMode) return;
    setLoggedIn(localStorage.getItem("white-page-demo-login-v2") === "true");
  }, [viewerMode]);

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => setMessages([]), 30 * 60 * 1000);
    return () => window.clearTimeout(timer);
  }, [open, messages.length]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const contextLabel = useMemo(() => {
    if (focusImage) return focusImage.name || "当前照片";
    return page?.name || "当前页面";
  }, [focusImage, page?.name]);

  if (!open) return null;

  const signIn = () => {
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      setError("请输入有效邮箱");
      return;
    }
    setOtpSent(true);
    setError("");
  };

  const verify = () => {
    if (otp !== "246810") {
      setError("验证码不正确");
      return;
    }
    localStorage.setItem("white-page-demo-login-v2", "true");
    setLoggedIn(true);
    setError("");
  };

  const ask = async (suggested?: string) => {
    const text = (suggested ?? question).trim();
    if (!text || pending) return;
    const userMessage: AIMessage = { id: createId("message"), role: "user", content: text };
    setMessages((current) => [...current, userMessage]);
    setQuestion("");
    setPending(true);
    setError("");
    try {
      const visibleText = page.elements
        .filter((element) => element.type === "text" || element.type === "ink")
        .map((element) => element.type === "text" ? element.text : element.transcript)
        .filter(Boolean)
        .join("\n");
      const image = focusImage ?? page.elements.find((element): element is ImageElement => element.type === "image" && !element.decorative);
      const response = await fetch("/api/ai/ask", {
        method: "POST",
        headers: { "content-type": "application/json", ...demoAuthHeaders(viewerMode ? DEMO_READER.id : DEMO_AUTHOR.id) },
        body: JSON.stringify({
          question: text,
          conversation: [...messages, userMessage].slice(-6).map(({ role, content }) => ({ role, content })),
          mode: viewerMode ? "published" : "draft",
          book: {
            id: book.id,
            versionId: viewerMode ? book.publishedSnapshot?.id ?? "preview" : "draft",
            title: book.title,
            description: book.description,
            pages: document.pages.map((item, index) => ({
              id: item.id,
              number: index + 1,
              name: item.name,
              text: item.elements.filter((element) => element.type === "text").map((element) => element.type === "text" ? element.text : "").join("\n"),
            })),
          },
          context: {
            pageId: page.id,
            pageName: page.name,
            pageText: visibleText,
            imageName: image?.name,
            imageAlt: image?.alt,
            imageUrl: image?.src,
            location: image?.location?.visibility === "exact" || (!viewerMode && includeExact) ? image?.location?.exactLabel || image?.location?.city : image?.location?.visibility === "city" ? image?.location?.city : undefined,
          },
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "AI 暂时无法回答");
      setMessages((current) => [...current, {
        id: createId("message"),
        role: "assistant",
        content: result.answer,
        citations: result.citations,
        sections: result.sections,
      }]);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "AI 暂时无法回答");
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <button className="ai-backdrop" onClick={onClose} aria-label="关闭 AI 面板" />
      <aside className="ai-panel" aria-label="摄影书 AI 问答">
        <header className="ai-panel-header">
          <div className="ai-panel-title"><span><Sparkles size={17} /></span><div><strong>摄影书 AI</strong><small>{viewerMode ? "基于公开版本回答" : "基于当前草稿回答"}</small></div></div>
          <button onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </header>

        {!loggedIn ? (
          <div className="ai-login">
            <div className="ai-login-icon"><LogIn size={22} /></div>
            <h2>登录后继续提问</h2>
            <p>问答只在当前会话保留，不会提供给作者查看。</p>
            {!otpSent ? <>
              <label><span>邮箱</span><input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" /></label>
              <button onClick={signIn}>发送验证码</button>
            </> : <>
              <label><span>六位验证码</span><input inputMode="numeric" maxLength={6} value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, ""))} placeholder="246810" /></label>
              <button onClick={verify}>验证并登录</button>
              <small className="demo-code">本地演示验证码：246810</small>
            </>}
            {error && <p className="field-error">{error}</p>}
          </div>
        ) : (
          <>
            <div className="ai-context-bar">
              <span>{focusImage ? <ImageIcon size={14} /> : <Bot size={14} />}{contextLabel}</span>
              {!viewerMode && focusImage?.location?.exactLabel && <label><input type="checkbox" checked={includeExact} onChange={(event) => setIncludeExact(event.target.checked)} /><MapPin size={13} />包含精确地点</label>}
            </div>

            <div className="ai-messages">
              {!messages.length && <div className="ai-empty">
                <div className="ai-orbit"><Sparkles size={22} /></div>
                <h2>从这一页开始</h2>
                <p>我会先阅读作品中的文字与图片说明，再按需查阅外部资料。</p>
                <div className="suggestion-list">
                  <button onClick={() => void ask("这张照片里的建筑可能属于什么风格？")}>这座建筑是什么风格？</button>
                  <button onClick={() => void ask("它可能有什么历史背景？请区分确定事实和视觉推测。")}>它有什么历史背景？</button>
                  <button onClick={() => void ask("这一页和整本摄影书之间有什么联系？")}>这一页与全书有什么联系？</button>
                </div>
              </div>}
              {messages.map((message) => <div key={message.id} className={`ai-message ${message.role}`}>
                {message.role === "assistant" && <span className="ai-message-mark"><Sparkles size={14} /></span>}
                <div>
                  {message.role === "assistant" && message.sections ? <>
                    {message.sections.book && <section><h3>摄影书中的信息</h3><p>{message.sections.book}</p></section>}
                    {message.sections.history && <section><h3>外部历史资料</h3><p>{message.sections.history}</p></section>}
                    {message.sections.interpretation && <section><h3>可能的视觉解读</h3><p>{message.sections.interpretation}</p></section>}
                  </> : <p>{message.content}</p>}
                  {!!message.citations?.length && <div className="citation-list">{message.citations.map((citation, index) => <a key={`${citation.url}-${index}`} href={citation.url} target={citation.sourceType === "web" ? "_blank" : undefined} rel="noreferrer"><span>{citation.sourceType === "book" ? "书" : index + 1}</span>{citation.title}<ExternalLink size={12} /></a>)}</div>}
                </div>
              </div>)}
              {pending && <div className="ai-message assistant loading"><span className="ai-message-mark"><Sparkles size={14} /></span><div className="typing-dots"><i /><i /><i /></div></div>}
              {error && <div className="ai-error">{error}</div>}
              <div ref={endRef} />
            </div>

            <form className="ai-composer" onSubmit={(event) => { event.preventDefault(); void ask(); }}>
              <textarea rows={2} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="询问这本摄影书…" onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void ask(); }
              }} />
              <button type="submit" disabled={!question.trim() || pending} aria-label="发送"><ArrowUp size={18} /></button>
              <div className="ai-composer-meta"><span><Check size={12} />会话内临时保存</span><span>今日剩余 {Math.max(0, 10 - messages.filter((message) => message.role === "user").length)} 次</span></div>
            </form>
          </>
        )}
      </aside>
    </>
  );
}
