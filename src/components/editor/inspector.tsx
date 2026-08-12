"use client";

import { AlignCenter, AlignLeft, AlignRight, ArrowDownToLine, ArrowUpToLine, Copy, Trash2 } from "lucide-react";
import { useBookStore } from "@/store/book-store";
import { FONT_OPTIONS } from "@/lib/fonts";
import type { FontFamily, ImageFilter, ImageShape, PageFormat, PageTransition, SceneElement } from "@/types/book";

const pageFormats: PageFormat[] = ["16:9", "4:3", "1:1", "3:4", "9:16"];

function NumberField({ label, value, min, max, step = 1, onChange }: { label: string; value: number; min?: number; max?: number; step?: number; onChange: (value: number) => void }) {
  return (
    <label className="number-field"><span>{label}</span><input type="number" value={Math.round(value * 100) / 100} min={min} max={max} step={step} onChange={(event) => onChange(Number(event.target.value))} /></label>
  );
}

function Segmented({ value, options, onChange, label }: { value: string; options: Array<{ value: string; label: React.ReactNode }>; onChange: (value: string) => void; label: string }) {
  return (
    <div className="field-stack"><span className="field-label">{label}</span><div className="segmented">
      {options.map((option) => <button key={option.value} className={value === option.value ? "active" : ""} onClick={() => onChange(option.value)}>{option.label}</button>)}
    </div></div>
  );
}

export function Inspector() {
  const {
    book,
    activePageId,
    selectedElementId,
    setBookMeta,
    setPageFormat,
    setPageTransition,
    updateElement,
    deleteSelected,
    duplicateSelected,
    moveLayer,
  } = useBookStore();
  const page = book.document.pages.find((item) => item.id === activePageId) ?? book.document.pages[0];
  const selected = page.elements.find((element) => element.id === selectedElementId);
  const patch = (next: Partial<SceneElement>) => selected && updateElement(selected.id, next);

  if (!selected) {
    return (
      <aside className="inspector" aria-label="页面设置">
        <div className="inspector-heading"><strong>页面</strong><span>固定白色底页</span></div>
        <label className="field-stack"><span className="field-label">摄影书标题</span><input value={book.title} onChange={(event) => setBookMeta({ title: event.target.value })} /></label>
        <label className="field-stack"><span className="field-label">副标题</span><input value={book.subtitle} onChange={(event) => setBookMeta({ subtitle: event.target.value })} /></label>
        <label className="field-stack"><span className="field-label">作品说明</span><textarea rows={4} value={book.description} onChange={(event) => setBookMeta({ description: event.target.value })} /></label>
        <div className="field-stack"><span className="field-label">页面比例</span><div className="format-grid">
          {pageFormats.map((format) => <button key={format} className={page.format === format ? "active" : ""} onClick={() => setPageFormat(format)}>{format}</button>)}
        </div></div>
        <label className="field-stack"><span className="field-label">进入本页的转场</span><select value={page.transition ?? "fade"} onChange={(event) => setPageTransition(event.target.value as PageTransition)}>
          <option value="none">无转场</option><option value="fade">淡入</option><option value="slide-left">向左滑动</option><option value="zoom">轻微缩放</option><option value="wipe">从左擦入</option>
        </select></label>
        <div className="white-policy"><span className="white-swatch" />白色底页不可修改</div>
        <label className="toggle-row"><span><strong>公开 AI 问答</strong><small>发布后允许登录浏览者提问</small></span><input type="checkbox" checked={book.aiEnabled} onChange={(event) => setBookMeta({ aiEnabled: event.target.checked })} /></label>
        <label className="toggle-row"><span><strong>公开评论</strong><small>发布后允许登录浏览者评论</small></span><input type="checkbox" checked={book.commentsEnabled} onChange={(event) => setBookMeta({ commentsEnabled: event.target.checked })} /></label>
      </aside>
    );
  }

  return (
    <aside className="inspector" aria-label="元素属性">
      <div className="inspector-heading"><strong>{selected.type === "image" ? (selected.decorative ? "装饰素材" : "照片") : selected.type === "text" ? "文字" : selected.type === "pattern" ? "图案" : "手写"}</strong><span>元素属性</span></div>

      {selected.type === "text" && <>
        <label className="field-stack"><span className="field-label">内容</span><textarea rows={5} value={selected.text} onChange={(event) => patch({ text: event.target.value } as Partial<SceneElement>)} /></label>
        <label className="field-stack"><span className="field-label">字体</span><select value={selected.fontFamily} style={{ fontFamily: FONT_OPTIONS.find((option) => option.value === selected.fontFamily)?.css }} onChange={(event) => patch({ fontFamily: event.target.value as FontFamily } as Partial<SceneElement>)}>
          {FONT_OPTIONS.map((font) => <option key={font.value} value={font.value} style={{ fontFamily: font.css }}>{font.label}</option>)}
        </select></label>
        <div className="field-grid"><NumberField label="字号" value={selected.fontSize} min={12} max={240} onChange={(fontSize) => patch({ fontSize } as Partial<SceneElement>)} /><label className="color-field"><span>颜色</span><input type="color" value={selected.color} onChange={(event) => patch({ color: event.target.value } as Partial<SceneElement>)} /></label></div>
        <Segmented label="对齐" value={selected.align} options={[{ value: "left", label: <AlignLeft size={16} /> }, { value: "center", label: <AlignCenter size={16} /> }, { value: "right", label: <AlignRight size={16} /> }]} onChange={(value) => patch({ align: value } as Partial<SceneElement>)} />
      </>}

      {selected.type === "image" && <>
        <label className="field-stack"><span className="field-label">素材名称</span><input value={selected.name} onChange={(event) => patch({ name: event.target.value } as Partial<SceneElement>)} /></label>
        <label className="field-stack"><span className="field-label">图片说明</span><textarea rows={3} value={selected.alt} onChange={(event) => patch({ alt: event.target.value } as Partial<SceneElement>)} /></label>
        <Segmented label="图片适应" value={selected.fit} options={[{ value: "cover", label: "填满" }, { value: "contain", label: "完整" }]} onChange={(value) => patch({ fit: value } as Partial<SceneElement>)} />
        <label className="field-stack"><span className="field-label">图片形状</span><select value={selected.shape ?? "rectangle"} onChange={(event) => patch({ shape: event.target.value as ImageShape } as Partial<SceneElement>)}>
          <option value="rectangle">矩形</option><option value="rounded">圆角矩形</option><option value="circle">圆形 / 椭圆</option><option value="arch">拱形</option>
        </select></label>
        <label className="field-stack"><span className="field-label">图片滤镜</span><select value={selected.filter ?? "none"} onChange={(event) => patch({ filter: event.target.value as ImageFilter } as Partial<SceneElement>)}>
          <option value="none">原图</option><option value="grayscale">黑白</option><option value="sepia">暖调复古</option><option value="blur">柔焦模糊</option><option value="contrast">高对比</option>
        </select></label>
        {!selected.decorative && <>
          <label className="field-stack"><span className="field-label">地点名称</span><input value={selected.location?.city ?? ""} placeholder="城市或地点" onChange={(event) => patch({ location: { ...selected.location, city: event.target.value, visibility: selected.location?.visibility ?? "hidden" } } as Partial<SceneElement>)} /></label>
          <Segmented label="地点可见范围" value={selected.location?.visibility ?? "hidden"} options={[{ value: "hidden", label: "隐藏" }, { value: "city", label: "城市" }, { value: "exact", label: "具体地点" }]} onChange={(value) => patch({ location: { ...selected.location, visibility: value } } as Partial<SceneElement>)} />
        </>}
      </>}

      {selected.type === "pattern" && <>
        <Segmented label="图案" value={selected.pattern} options={[{ value: "dots", label: "波点" }, { value: "grid", label: "网格" }, { value: "stripes", label: "条纹" }]} onChange={(value) => patch({ pattern: value } as Partial<SceneElement>)} />
        <div className="field-grid"><label className="color-field"><span>颜色</span><input type="color" value={selected.foreground} onChange={(event) => patch({ foreground: event.target.value } as Partial<SceneElement>)} /></label><NumberField label="间距" value={selected.spacing} min={12} max={120} onChange={(spacing) => patch({ spacing } as Partial<SceneElement>)} /></div>
      </>}

      {selected.type === "ink" && <label className="field-stack"><span className="field-label">无障碍文字转写</span><textarea rows={4} placeholder="可选，不会显示在页面上" value={selected.transcript ?? ""} onChange={(event) => patch({ transcript: event.target.value } as Partial<SceneElement>)} /></label>}

      <div className="field-grid transform-grid">
        <NumberField label="旋转" value={selected.rotation} min={-360} max={360} onChange={(rotation) => patch({ rotation } as Partial<SceneElement>)} />
        <NumberField label="透明度" value={selected.opacity} min={0.05} max={1} step={0.05} onChange={(opacity) => patch({ opacity } as Partial<SceneElement>)} />
      </div>
      <label className="range-field"><span>透明度</span><input type="range" min="0.05" max="1" step="0.05" value={selected.opacity} onChange={(event) => patch({ opacity: Number(event.target.value) } as Partial<SceneElement>)} /></label>

      <div className="inspector-actions">
        <button onClick={() => moveLayer("front")}><ArrowUpToLine size={16} />置于顶层</button>
        <button onClick={() => moveLayer("back")}><ArrowDownToLine size={16} />置于底层</button>
        <button onClick={duplicateSelected}><Copy size={16} />复制</button>
        <button className="danger" onClick={deleteSelected}><Trash2 size={16} />删除</button>
      </div>
    </aside>
  );
}
