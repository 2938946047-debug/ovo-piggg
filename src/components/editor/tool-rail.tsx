"use client";

import { useRef } from "react";
import { ImagePlus, MousePointer2, PenLine, Shapes, Type } from "lucide-react";
import * as exifr from "exifr";
import { IconButton } from "@/components/ui/icon-button";
import { prepareImportedImage } from "@/lib/image-import";
import { useBookStore } from "@/store/book-store";

export function ToolRail() {
  const imageInput = useRef<HTMLInputElement>(null);
  const { tool, setTool, addText, addImage } = useBookStore();

  const addPhoto = async (file: File) => {
    if (!file.type.startsWith("image/")) return;
    const src = await prepareImportedImage(file);
    let location: { exactLabel: string; latitude: number; longitude: number; visibility: "hidden" } | undefined;
    try {
      const gps = await exifr.gps(file);
      if (gps?.latitude && gps?.longitude) location = {
        exactLabel: `${gps.latitude.toFixed(5)}, ${gps.longitude.toFixed(5)}`,
        latitude: gps.latitude,
        longitude: gps.longitude,
        visibility: "hidden",
      };
    } catch {
      location = undefined;
    }
    addImage(src, file.name, "作者导入的照片", false, location);
  };

  return (
    <aside className="tool-rail" aria-label="内容工具">
      <IconButton label="选择" icon={<MousePointer2 size={20} />} active={tool === "select"} onClick={() => setTool("select")} />
      <IconButton label="添加照片" icon={<ImagePlus size={20} />} active={tool === "image"} onClick={() => imageInput.current?.click()} />
      <IconButton label="添加文字" icon={<Type size={20} />} active={tool === "text"} onClick={() => { addText(); setTool("select"); }} />
      <IconButton label="图案" icon={<Shapes size={20} />} active={tool === "pattern"} onClick={() => setTool(tool === "pattern" ? "select" : "pattern")} />
      <IconButton label="手写" icon={<PenLine size={20} />} active={tool === "ink"} onClick={() => setTool(tool === "ink" ? "select" : "ink")} />
      <input
        ref={imageInput}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void addPhoto(file);
          event.target.value = "";
        }}
      />
    </aside>
  );
}
