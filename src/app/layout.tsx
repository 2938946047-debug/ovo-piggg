import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "白页 · 电子摄影书编辑器",
  description: "自由排版、手写与 AI 资料问答的极简电子摄影书工具",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-CN"><body>{children}</body></html>;
}
