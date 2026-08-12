"use client";

import { useEffect, useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { AIAssistant } from "@/components/ai/ai-assistant";
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
  const [view, setView] = useState<View>("dashboard");
  const [aiOpen, setAiOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [mobileInspector, setMobileInspector] = useState(false);
  const [publicLoad, setPublicLoad] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [publicError, setPublicError] = useState("");
  const book = useBookStore((state) => state.book);
  const selectBook = useBookStore((state) => state.selectBook);
  const createBlankBook = useBookStore((state) => state.createBlankBook);
  const openPublicBook = useBookStore((state) => state.openPublicBook);

  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("book");
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

  const openOwnedBook = (bookId: string, target: "editor" | "preview") => {
    const selected = useBookStore.getState().books.find((item) => item.id === bookId);
    if (!selected || !canEditBook(selected, DEMO_AUTHOR.id)) return;
    selectBook(bookId);
    setView(target);
  };

  const createBook = async () => {
    try {
      const response = await fetch("/api/books", { method: "POST", headers: { "content-type": "application/json", ...demoAuthHeaders(DEMO_AUTHOR.id) }, body: JSON.stringify({ title: "未命名摄影书" }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      createBlankBook(DEMO_AUTHOR.id, DEMO_AUTHOR.name, result.id, result.slug);
      setView("editor");
    } catch {
      setView("dashboard");
    }
  };

  if (view === "public-reader" && publicLoad === "loading") return <main className="public-reader-state"><span className="state-spinner" /><strong>正在打开摄影书</strong><p>正在加载作者发布的版本…</p></main>;
  if (view === "public-reader" && publicLoad === "error") return <main className="public-reader-state"><strong>暂时无法打开</strong><p>{publicError}</p><button onClick={() => { setPublicLoad("idle"); setView("gallery"); }}>浏览作品广场</button></main>;

  if (view === "dashboard") return <Dashboard onEdit={(id) => openOwnedBook(id, "editor")} onRead={(id) => openOwnedBook(id, "preview")} onCreate={() => void createBook()} onGallery={() => setView("gallery")} />;
  if (view === "gallery") return <Gallery onBack={() => setView("dashboard")} onOpen={() => setView("public-reader")} onCreate={() => void createBook()} />;
  if (view === "preview" || view === "public-reader") return <BookReader publishedOnly={view === "public-reader"} onBack={() => setView(view === "public-reader" ? "gallery" : "editor")} onGallery={() => setView("gallery")} />;

  if (!canEditBook(book, DEMO_AUTHOR.id)) return <BookReader publishedOnly onBack={() => setView("gallery")} onGallery={() => setView("gallery")} />;

  return (
    <main className="editor-shell">
      <Topbar onDashboard={() => setView("dashboard")} onPreview={() => setView("preview")} onAI={() => setAiOpen(true)} onPublish={() => setPublishOpen(true)} onExport={() => setExportOpen(true)} />
      <div className="editor-workspace">
        <ToolRail />
        <PageRail />
        <section className="editor-canvas-area">
          <div className="canvas-label"><span>第 {book.document.pages.findIndex((page) => page.id === useBookStore.getState().activePageId) + 1} 页</span><span>白色底页</span></div>
          <EditorCanvas maxHeight={760} />
          <PatternPanel />
        </section>
        <div className="desktop-inspector"><Inspector /></div>
      </div>

      <button className="mobile-inspector-button" onClick={() => setMobileInspector(true)}><SlidersHorizontal size={18} />属性</button>
      {mobileInspector && <div className="mobile-inspector-sheet"><button className="mobile-sheet-close" onClick={() => setMobileInspector(false)} aria-label="关闭属性面板"><X size={19} /></button><Inspector /></div>}

      <AIAssistant open={aiOpen} onClose={() => setAiOpen(false)} />
      <ExportDialog open={exportOpen} onOpenChange={setExportOpen} />
      <PublishDialog open={publishOpen} onOpenChange={setPublishOpen} onReadPublished={() => setView("public-reader")} />
    </main>
  );
}
