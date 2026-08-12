"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { AIAssistant } from "@/components/ai/ai-assistant";
import { AuthGate } from "@/components/auth/auth-gate";
import { useAuth } from "@/components/auth/auth-provider";
import { Dashboard } from "@/components/dashboard/dashboard";
import { Gallery } from "@/components/dashboard/gallery";
import { ExportDialog } from "@/components/dialogs/export-dialog";
import { PublishDialog } from "@/components/dialogs/publish-dialog";
import EditorCanvas from "@/components/editor/editor-canvas";
import { Inspector } from "@/components/editor/inspector";
import { PageRail } from "@/components/editor/page-rail";
import { PatternPanel } from "@/components/editor/pattern-panel";
import { ToolRail } from "@/components/editor/tool-rail";
import { Topbar } from "@/components/editor/topbar";
import { BookReader } from "@/components/reader/book-reader";
import { useBookStore } from "@/store/book-store";
import { canEditBook } from "@/lib/access-control";
import { DEMO_AUTHOR, demoAuthHeaders } from "@/lib/demo-auth";
import type { Photobook, PublishedSnapshot } from "@/types/book";

type View = "dashboard" | "editor" | "preview" | "public-reader" | "gallery";

export function PhotobookApp() {
  const auth = useAuth();
  const [view, setView] = useState<View>("dashboard");
  const [aiOpen, setAiOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [mobileInspector, setMobileInspector] = useState(false);
  const [publicLoad, setPublicLoad] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [publicError, setPublicError] = useState("");
  const [routeChecked, setRouteChecked] = useState(false);
  const [booksLoading, setBooksLoading] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [aiAvailable, setAiAvailable] = useState(false);
  const [commentsAvailable, setCommentsAvailable] = useState(false);
  const book = useBookStore((state) => state.book);
  const selectBook = useBookStore((state) => state.selectBook);
  const createBlankBook = useBookStore((state) => state.createBlankBook);
  const openPublicBook = useBookStore((state) => state.openPublicBook);
  const replaceBooks = useBookStore((state) => state.replaceBooks);

  useEffect(() => {
    let active = true;
    fetch("/api/capabilities", { cache: "no-store" })
      .then((response) => response.json())
      .then((result: { ai?: boolean; auth?: boolean }) => {
        if (!active) return;
        setAiAvailable(Boolean(result.ai));
        setCommentsAvailable(Boolean(result.auth));
      })
      .catch(() => {
        if (!active) return;
        setAiAvailable(false);
        setCommentsAvailable(false);
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("book");
    setRouteChecked(true);
    if (!slug) return;
    let active = true;
    setView("public-reader");
    setPublicLoad("loading");
    fetch(`/api/public/books/${encodeURIComponent(slug)}`, { cache: "no-store" })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "无法加载这本摄影书");
        return result as {
          id: string;
          slug: string;
          title: string;
          subtitle: string;
          author: string;
          description: string;
          visibility?: "unlisted" | "public";
          aiEnabled: boolean;
          commentsEnabled: boolean;
          publishedSnapshot: PublishedSnapshot;
        };
      })
      .then((result) => {
        if (!active) return;
        const publicBook: Photobook = {
          id: result.id,
          slug: result.slug,
          authorId: "public-author",
          title: result.title,
          subtitle: result.subtitle,
          author: result.author,
          description: result.description,
          status: result.visibility ?? "public",
          aiEnabled: result.aiEnabled,
          commentsEnabled: result.commentsEnabled,
          updatedAt: result.publishedSnapshot.publishedAt,
          document: result.publishedSnapshot.document,
          publishedSnapshot: result.publishedSnapshot,
        };
        openPublicBook(publicBook);
        setPublicLoad("ready");
      })
      .catch((error) => {
        if (!active) return;
        setPublicError(error instanceof Error ? error.message : "无法加载这本摄影书");
        setPublicLoad("error");
      });
    return () => { active = false; };
  }, [openPublicBook]);

  useEffect(() => {
    if (!auth.configured || !auth.user || view !== "dashboard") return;
    let active = true;
    setBooksLoading(true);
    void auth.getAccessToken().then(async (token) => {
      const response = await fetch("/api/books", {
        cache: "no-store",
        headers: token ? { authorization: `Bearer ${token}` } : undefined,
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "无法加载摄影书");
      if (active) replaceBooks(result.books);
    }).catch((error) => {
      if (active) setSaveError(error instanceof Error ? error.message : "无法加载摄影书");
    }).finally(() => active && setBooksLoading(false));
    return () => { active = false; };
  }, [auth.configured, auth.getAccessToken, auth.user, replaceBooks, view]);

  useEffect(() => {
    if (!auth.configured || !auth.user || view !== "editor" || book.authorId !== auth.user.id) return;
    const timer = window.setTimeout(() => {
      void auth.getAccessToken().then(async (token) => {
        if (!token) throw new Error("登录已失效，请重新登录");
        const activePage = book.document.pages.find((page) => page.id === useBookStore.getState().activePageId) ?? book.document.pages[0];
        const response = await fetch(`/api/pages/${activePage.id}`, {
          method: "PUT",
          headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
          body: JSON.stringify({
            bookId: book.id,
            title: book.title,
            subtitle: book.subtitle,
            description: book.description,
            aiEnabled: book.aiEnabled,
            commentsEnabled: book.commentsEnabled,
            backgroundPolicy: book.document.backgroundPolicy,
            page: activePage,
            document: book.document,
          }),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "自动保存失败");
        setSaveError("");
      }).catch((error) => setSaveError(error instanceof Error ? error.message : "自动保存失败"));
    }, 900);
    return () => window.clearTimeout(timer);
  }, [auth.configured, auth.getAccessToken, auth.user, book, view]);

  const openOwnedBook = (bookId: string, target: "editor" | "preview") => {
    const selected = useBookStore.getState().books.find((item) => item.id === bookId);
    const authorId = auth.user?.id ?? DEMO_AUTHOR.id;
    if (!selected || !canEditBook(selected, authorId)) return;
    selectBook(bookId);
    setView(target);
  };

  const createBook = async () => {
    try {
      const token = await auth.getAccessToken();
      const authorId = auth.user?.id ?? DEMO_AUTHOR.id;
      const authorName = auth.user ? auth.displayName : DEMO_AUTHOR.name;
      const response = await fetch("/api/books", { method: "POST", headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : demoAuthHeaders(DEMO_AUTHOR.id)) }, body: JSON.stringify({ title: "未命名摄影书" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      createBlankBook(authorId, authorName, result.id, result.slug);
      setView("editor");
    } catch {
      setView("dashboard");
    }
  };

  if (view === "public-reader" && publicLoad === "loading") return <main className="public-reader-state"><span className="state-spinner" /><strong>正在打开摄影书</strong><p>正在加载作者发布的版本…</p></main>;
  if (view === "public-reader" && publicLoad === "error") return <main className="public-reader-state"><strong>暂时无法打开</strong><p>{publicError}</p><button onClick={() => { setPublicLoad("idle"); setView("gallery"); }}>浏览作品广场</button></main>;

  if (!routeChecked || (auth.loading && view !== "public-reader")) return <main className="public-reader-state"><span className="state-spinner" /><strong>正在连接白页</strong></main>;
  if (auth.configured && !auth.user && view !== "public-reader") return <AuthGate />;
  if (booksLoading && view === "dashboard") return <main className="public-reader-state"><span className="state-spinner" /><strong>正在加载你的摄影书</strong></main>;

  const authorId = auth.user?.id ?? DEMO_AUTHOR.id;
  const authorName = auth.user ? auth.displayName : DEMO_AUTHOR.name;

  if (view === "dashboard") return <><Dashboard onEdit={(id) => openOwnedBook(id, "editor")} onRead={(id) => openOwnedBook(id, "preview")} onCreate={() => void createBook()} onGallery={() => setView("gallery")} authorId={authorId} authorName={authorName} onSignOut={() => void auth.signOut()} aiAvailable={aiAvailable} />{saveError && <div className="save-error-toast">{saveError}</div>}</>;
  if (view === "gallery") return <Gallery onBack={() => setView("dashboard")} onOpen={() => setView("public-reader")} onCreate={() => void createBook()} aiAvailable={aiAvailable} />;
  if (view === "preview" || view === "public-reader") return <BookReader publishedOnly={view === "public-reader"} onBack={() => setView(view === "public-reader" ? "gallery" : "editor")} onGallery={() => setView("gallery")} aiAvailable={aiAvailable} commentsAvailable={commentsAvailable} />;

  if (!canEditBook(book, authorId)) return <BookReader publishedOnly onBack={() => setView("gallery")} onGallery={() => setView("gallery")} aiAvailable={aiAvailable} commentsAvailable={commentsAvailable} />;

  return (
    <main className="editor-shell">
      <Topbar onDashboard={() => setView("dashboard")} onPreview={() => setView("preview")} onAI={() => setAiOpen(true)} onPublish={() => setPublishOpen(true)} onExport={() => setExportOpen(true)} authorName={authorName} aiAvailable={aiAvailable} />
      <div className="editor-workspace">
        <ToolRail />
        <PageRail />
        <section className="editor-canvas-area">
          <div className="canvas-label"><span>第 {book.document.pages.findIndex((page) => page.id === useBookStore.getState().activePageId) + 1} 页</span><span>白色底页</span></div>
          <EditorCanvas maxHeight={760} />
          <PatternPanel />
        </section>
        <div className="desktop-inspector"><Inspector aiAvailable={aiAvailable} commentsAvailable={commentsAvailable} /></div>
      </div>

      <button className="mobile-inspector-button" onClick={() => setMobileInspector(true)}><SlidersHorizontal size={18} />属性</button>
      {mobileInspector && <div className="mobile-inspector-sheet"><button className="mobile-sheet-close" onClick={() => setMobileInspector(false)} aria-label="关闭属性面板"><X size={19} /></button><Inspector aiAvailable={aiAvailable} commentsAvailable={commentsAvailable} /></div>}

      {aiAvailable && <AIAssistant open={aiOpen} onClose={() => setAiOpen(false)} />}
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} onReadPublished={() => setView("public-reader")} aiAvailable={aiAvailable} commentsAvailable={commentsAvailable} />
      {saveError && <div className="save-error-toast">{saveError}</div>}
    </main>
  );
}
