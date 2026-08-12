import type { SceneDocumentV1 } from "@/types/book";

export interface PolicyResult {
  valid: boolean;
  error?: string;
}

export function validateWhitePagePolicy(value: unknown): PolicyResult {
  if (!value || typeof value !== "object") return { valid: false, error: "文档格式无效" };
  const document = value as Partial<SceneDocumentV1>;
  if (document.version !== 1 || document.backgroundPolicy !== "fixed-white" || !Array.isArray(document.pages)) {
    return { valid: false, error: "仅支持 SceneDocumentV1 与固定白页策略" };
  }
  if (!document.pages.length) return { valid: false, error: "摄影书至少需要一页" };
  for (const page of document.pages) {
    if (page.background !== "#ffffff") return { valid: false, error: `页面 ${page.id || "未知"} 的底色必须为纯白` };
    if (!Number.isFinite(page.width) || !Number.isFinite(page.height) || page.width <= 0 || page.height <= 0) {
      return { valid: false, error: "页面尺寸无效" };
    }
  }
  return { valid: true };
}

export function enforceWhitePagePolicy(document: SceneDocumentV1): SceneDocumentV1 {
  return {
    ...structuredClone(document),
    version: 1,
    backgroundPolicy: "fixed-white",
    pages: document.pages.map((page) => ({ ...page, background: "#ffffff" })),
  };
}
