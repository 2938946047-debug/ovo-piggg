export type PageFormat = "16:9" | "4:3" | "1:1" | "3:4" | "9:16";
export type EditorTool = "select" | "image" | "text" | "pattern" | "ink";
export type PatternKind = "dots" | "grid" | "stripes" | "checker" | "waves" | "frame";
export type FontFamily = "sans" | "serif" | "song" | "kai" | "rounded" | "mono" | "display";
export type PageTransition = "none" | "fade" | "slide-left" | "zoom" | "wipe";
export type ImageShape = "rectangle" | "rounded" | "circle" | "arch";
export type ImageFilter = "none" | "grayscale" | "sepia" | "blur" | "contrast";

export interface TransformableElement {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  opacity: number;
}

export interface ImageElement extends TransformableElement {
  type: "image";
  src: string;
  fit: "cover" | "contain";
  shape?: ImageShape;
  filter?: ImageFilter;
  name: string;
  alt: string;
  decorative?: boolean;
  location?: {
    city?: string;
    exactLabel?: string;
    latitude?: number;
    longitude?: number;
    visibility: "hidden" | "city" | "exact";
  };
}

export interface TextElement extends TransformableElement {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: FontFamily;
  fontWeight: 400 | 500 | 600 | 700;
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
}

export interface PatternElement extends TransformableElement {
  type: "pattern";
  pattern: PatternKind;
  foreground: string;
  background: string;
  spacing: number;
  scale: number;
}

export interface InkPoint {
  x: number;
  y: number;
  pressure: number;
}

export interface InkStroke {
  id: string;
  points: InkPoint[];
  color: string;
  size: number;
  opacity: number;
}

export interface InkElement extends TransformableElement {
  type: "ink";
  strokes: InkStroke[];
  transcript?: string;
}

export type SceneElement = ImageElement | TextElement | PatternElement | InkElement;

export interface ScenePage {
  id: string;
  name: string;
  format: PageFormat;
  width: number;
  height: number;
  background: "#ffffff";
  transition?: PageTransition;
  elements: SceneElement[];
}

export interface SceneDocumentV1 {
  version: 1;
  backgroundPolicy: "fixed-white";
  pages: ScenePage[];
}

export interface PublishedSnapshot {
  id: string;
  publishedAt: string;
  document: SceneDocumentV1;
}

export interface Photobook {
  id: string;
  slug: string;
  authorId: string;
  title: string;
  subtitle: string;
  author: string;
  description: string;
  status: "draft" | "unlisted" | "public";
  aiEnabled: boolean;
  commentsEnabled: boolean;
  updatedAt: string;
  document: SceneDocumentV1;
  publishedSnapshot?: PublishedSnapshot;
}

export interface BookComment {
  id: string;
  bookId: string;
  versionId: string;
  userId: string;
  authorName: string;
  authorInitial: string;
  body: string;
  createdAt: string;
  pageNumber?: number;
  canDelete?: boolean;
}

export interface Citation {
  title: string;
  url: string;
  sourceType: "book" | "web";
}

export interface AIMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
  sections?: {
    book?: string;
    history?: string;
    interpretation?: string;
  };
}

export const PAGE_FORMATS: Record<PageFormat, { width: number; height: number }> = {
  "16:9": { width: 1600, height: 900 },
  "4:3": { width: 1440, height: 1080 },
  "1:1": { width: 1200, height: 1200 },
  "3:4": { width: 1080, height: 1440 },
  "9:16": { width: 900, height: 1600 },
};
