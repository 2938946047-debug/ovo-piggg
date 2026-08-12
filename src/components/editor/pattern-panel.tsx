"use client";

import { useRef, useState } from "react";
import { Upload, X } from "lucide-react";
import { useBookStore } from "@/store/book-store";
import { demoAuthHeaders } from "@/lib/demo-auth";
import { prepareImportedImage } from "@/lib/image-import";
import type { PatternKind } from "@/types/book";

const patterns: Array<{ kind: PatternKind; label: string }> = [
  { kind: "dots", label: "波点" },
  { kind: "grid", label: "网格" },
  { kind: "stripes", label: "条纹" },
  { kind: "checker", label: "棋盘" },
  { kind: "waves", label: "波浪" },
  { kind: "frame", label: "边框" },
];

export function PatternPanel() {
  const { book, tool, setTool, addPattern, addImage } = useBookStore();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState("");
  if (tool !== "pattern") return null;

  const processDecoration = async (file: File) => {
    setError("");
    if (!["image/png", "image/webp", "image/svg+xml"].includes(file.type)) {
      setError("仅支持 PNG、WebP 或 SVG");
      return;
    }
    if (file.size > (file.type === "image/svg+xml" ? 1024 * 1024 : 5 * 1024 * 1024)) {
      setError("素材超过大小限制");
      return;
    }
    if (file.type === "image/svg+xml") {
      const source = await file.text();
      const response = await fetch("/api/decorations/process", {
        method: "POST",
        headers: { "content-type": "application/json", ...demoAuthHeaders(book.authorId) },
        body: JSON.stringify({ source, name: file.name }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error ?? "SVG 无法通过安全检查");
        return;
      }
      addImage(result.dataUrl, file.name, "作者导入的装饰图案", true);
    } else {
      const dataUrl = await prepareImportedImage(file, 1200);
      addImage(dataUrl, file.name, "作者导入的装饰图案", true);
    }
    setTool("select");
  };

  return (
    <section className="pattern-panel" aria-label="图案库">
      <header>
        <div><strong>图案</strong><span>添加后可自由调整</span></div>
        <button onClick={() => setTool("select")} aria-label="关闭图案库"><X size={18} /></button>
      </header>
      <div className="pattern-grid">
        {patterns.map((pattern) => (
          <button key={pattern.kind} onClick={() => { addPattern(pattern.kind); setTool("select"); }}>
            <span className={`pattern-swatch pattern-kind-${pattern.kind}`} aria-hidden="true" />
            {pattern.label}
          </button>
        ))}
      </div>
      <button className="pattern-upload" onClick={() => input.current?.click()}><Upload size={17} />导入自己的图案</button>
      {error && <p className="field-error">{error}</p>}
      <input ref={input} hidden type="file" accept="image/png,image/webp,image/svg+xml" onChange={(event) => {
        const file = event.target.files?.[0];
        if (file) void processDecoration(file);
        event.target.value = "";
      }} />
    </section>
  );
}
