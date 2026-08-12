"use client";

import { BookOpen, Bot, Clock3, LogOut, MoreHorizontal, Plus, Search } from "lucide-react";
import { useBookStore } from "@/store/book-store";

interface DashboardProps {
  onEdit: (bookId: string) => void;
  onRead: (bookId: string) => void;
  onCreate: () => void;
  onGallery: () => void;
  authorId: string;
  authorName: string;
  onSignOut: () => void;
}

export function Dashboard({ onEdit, onRead, onCreate, onGallery, authorId, authorName, onSignOut }: DashboardProps) {
  const allBooks = useBookStore((state) => state.books);
  const books = allBooks.filter((book) => book.authorId === authorId);
  return (
    <main className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="dashboard-brand"><span className="brand-mark" /><strong>白页</strong></div>
        <nav>
          <button className="active"><BookOpen size={18} />我的作品</button>
          <button onClick={onGallery}><span className="nav-grid-icon" />作品广场</button>
          <button><Bot size={18} />AI 用量</button>
        </nav>
        <button className="dashboard-settings" onClick={onSignOut}><LogOut size={18} />退出登录</button>
        <div className="dashboard-account"><span>{authorName.slice(0, 1)}</span><div><strong>{authorName}</strong><small>创作者账户</small></div></div>
      </aside>

      <section className="dashboard-main">
        <header className="dashboard-header">
          <div><h1>我的摄影书</h1><p>管理草稿、公开版本与导出任务</p></div>
          <label className="dashboard-search"><Search size={17} /><input placeholder="搜索作品" /></label>
          <button className="new-book-button" onClick={onCreate}><Plus size={18} />新建摄影书</button>
        </header>

        <div className="dashboard-tabs"><button className="active">全部 <span>{books.length}</span></button><button>草稿</button><button>已发布</button></div>
        <div className="book-grid">
          {books.map((book) => {
            const cover = book.document.pages[0].elements.find((element) => element.type === "image");
            return <article className="book-card" key={book.id}>
              <button className="book-cover" onClick={() => onEdit(book.id)} aria-label={`编辑 ${book.title}`}>
                {cover?.type === "image" && <img src={cover.src} alt="摄影书封面" />}
                <span className={`status-pill ${book.status}`}>{book.status === "draft" ? "草稿" : book.status === "public" ? "公开" : "私密链接"}</span>
                <span className="owner-pill">我的作品</span>
                <span className="book-cover-title"><strong>{book.title}</strong><small>{book.subtitle}</small></span>
              </button>
              <div className="book-card-info"><button onClick={() => onEdit(book.id)}><strong>{book.title}</strong><span><Clock3 size={13} />刚刚编辑 · {book.document.pages.length} 页</span></button><button aria-label="更多选项"><MoreHorizontal size={18} /></button></div>
              <div className="book-card-actions"><button onClick={() => onEdit(book.id)}>继续编辑</button><button onClick={() => onRead(book.id)}>阅读预览</button></div>
            </article>;
          })}
          <button className="create-book-tile" onClick={onCreate}><span><Plus size={23} /></span><strong>创建空白摄影书</strong><small>从一张纯白页面开始</small></button>
        </div>
      </section>
    </main>
  );
}
