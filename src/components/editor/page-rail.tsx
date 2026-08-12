"use client";

import { Copy, Plus, Trash2 } from "lucide-react";
import { useBookStore } from "@/store/book-store";

export function PageRail() {
  const { book, activePageId, setActivePage, addPage, duplicatePage, deletePage, movePage } = useBookStore();

  return (
    <aside className="page-rail" aria-label="页面列表">
      <div className="page-rail-heading"><span>页面</span><span>{book.document.pages.length}</span></div>
      <div className="page-list">
        {book.document.pages.map((page, index) => {
          const image = page.elements.find((element) => element.type === "image");
          return (
            <div
              key={page.id}
              className={`page-thumb-row ${activePageId === page.id ? "active" : ""}`}
              draggable
              onDragStart={(event) => event.dataTransfer.setData("text/page-id", page.id)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => {
                event.preventDefault();
                const dragged = event.dataTransfer.getData("text/page-id");
                if (dragged) movePage(dragged, page.id);
              }}
            >
              <button className="page-thumb-main" onClick={() => setActivePage(page.id)} aria-label={`打开第 ${index + 1} 页`}>
                <span className="page-index">{String(index + 1).padStart(2, "0")}</span>
                <span className="page-thumb" style={{ aspectRatio: `${page.width}/${page.height}` }}>
                  {image?.type === "image" && <img src={image.src} alt="" />}
                  <span className="page-thumb-mark">{page.name}</span>
                </span>
              </button>
              {activePageId === page.id && (
                <div className="page-row-actions">
                  <button onClick={() => duplicatePage(page.id)} aria-label="复制页面"><Copy size={14} /></button>
                  <button onClick={() => deletePage(page.id)} aria-label="删除页面" disabled={book.document.pages.length === 1}><Trash2 size={14} /></button>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <button className="add-page-button" onClick={() => addPage("4:3")}><Plus size={16} />添加页面</button>
    </aside>
  );
}
