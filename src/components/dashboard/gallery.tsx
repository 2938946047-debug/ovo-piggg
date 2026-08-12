"use client";

import { ArrowLeft, ArrowUpRight, Plus, Search } from "lucide-react";
import { useBookStore } from "@/store/book-store";

interface GalleryProps {
  onBack: () => void;
  onOpen: () => void;
  onCreate: () => void;
}

const editorial = [
  { title: "海岸线以北", author: "林屿", image: "/images/coast.jpg", meta: "宁波 · 12 页" },
  { title: "混凝土的下午", author: "周序", image: "/images/concrete.jpg", meta: "上海 · 18 页" },
  { title: "日常构件", author: "陆未", image: "/images/detail.jpg", meta: "杭州 · 9 页" },
];

export function Gallery({ onBack, onOpen, onCreate }: GalleryProps) {
  const book = useBookStore((state) => state.book);
  return (
    <main className="gallery-shell">
      <header className="gallery-header"><button onClick={onBack} aria-label="返回控制台"><ArrowLeft size={19} /></button><div className="dashboard-brand"><span className="brand-mark" /><strong>白页</strong></div><nav><button className="active">作品广场</button><button>新发布</button><button>编辑精选</button></nav><label><Search size={17} /><input placeholder="搜索摄影书或地点" /></label></header>
      <section className="gallery-intro"><div><h1>公开摄影书</h1><p>照片、文字与手写在白页上保留各自的声音。</p></div><div className="gallery-intro-actions"><span>{book.status === "public" ? "4" : "3"} 本作品</span><button onClick={onCreate}><Plus size={16} />开始创作</button></div></section>
      <section className="gallery-grid">
        {book.status === "public" && <article className="gallery-item featured"><button onClick={onOpen}><div className="gallery-image"><img src="/images/coast.jpg" alt="海岸与建筑摄影" /><span>最新发布</span></div><div><h2>{book.title}</h2><p>{book.author}</p><small>{book.document.pages.length} 页 · AI 问答{book.aiEnabled ? "开放" : "关闭"}</small><ArrowUpRight size={18} /></div></button></article>}
        {editorial.map((item, index) => <article className="gallery-item" key={item.title}><button onClick={onOpen}><div className="gallery-image"><img src={item.image} alt="" /></div><div><h2>{item.title}</h2><p>{item.author}</p><small>{item.meta}</small><ArrowUpRight size={18} /></div></button></article>)}
      </section>
    </main>
  );
}
