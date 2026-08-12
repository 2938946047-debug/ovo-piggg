import type { FontFamily } from "@/types/book";

export const FONT_OPTIONS: Array<{ value: FontFamily; label: string; css: string }> = [
  { value: "sans", label: "现代黑体", css: 'Inter, "Noto Sans SC", "Microsoft YaHei", sans-serif' },
  { value: "serif", label: "现代宋体", css: '"Noto Serif SC", "Songti SC", serif' },
  { value: "song", label: "传统宋体", css: 'STSong, SimSun, "Noto Serif SC", serif' },
  { value: "kai", label: "楷体", css: '"Kaiti SC", STKaiti, KaiTi, serif' },
  { value: "rounded", label: "圆体", css: '"Yuanti SC", "Microsoft YaHei", sans-serif' },
  { value: "mono", label: "等宽体", css: '"SFMono-Regular", "Cascadia Mono", "Courier New", monospace' },
  { value: "display", label: "海报黑体", css: 'Impact, "PingFang SC", "Microsoft YaHei", sans-serif' },
];

export function getFontFamilyCss(font: FontFamily) {
  return FONT_OPTIONS.find((option) => option.value === font)?.css ?? FONT_OPTIONS[0].css;
}
