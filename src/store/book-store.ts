"use client";

import { create } from "zustand";
import { createJSONStorage, persist, type StateStorage } from "zustand/middleware";
import { createId } from "@/lib/ids";
import { sampleBook } from "@/lib/sample-book";
import type {
  EditorTool,
  InkElement,
  PageFormat,
  PageTransition,
  PatternKind,
  Photobook,
  ImageElement,
  SceneElement,
  ScenePage,
} from "@/types/book";
import { PAGE_FORMATS } from "@/types/book";

let localStorageFull = false;
const safeLocalStorage: StateStorage = {
  getItem: (name) => window.localStorage.getItem(name),
  setItem: (name, value) => {
    if (localStorageFull) return;
    try {
      window.localStorage.setItem(name, value);
    } catch {
      localStorageFull = true;
    }
  },
  removeItem: (name) => window.localStorage.removeItem(name),
};

interface BookStore {
  book: Photobook;
  books: Photobook[];
  activePageId: string;
  selectedElementId: string | null;
  tool: EditorTool;
  savedAt: string;
  past: Photobook[];
  future: Photobook[];
  setTool: (tool: EditorTool) => void;
  setActivePage: (pageId: string) => void;
  selectElement: (elementId: string | null) => void;
  setBookMeta: (patch: Partial<Pick<Photobook, "title" | "subtitle" | "description" | "aiEnabled" | "commentsEnabled">>) => void;
  selectBook: (bookId: string) => void;
  openPublicBook: (book: Photobook) => void;
  createBlankBook: (authorId: string, authorName: string, bookId?: string, slug?: string) => string;
  addPage: (format?: PageFormat) => void;
  duplicatePage: (pageId: string) => void;
  deletePage: (pageId: string) => void;
  movePage: (pageId: string, targetPageId: string) => void;
  setPageFormat: (format: PageFormat) => void;
  setPageTransition: (transition: PageTransition) => void;
  addText: () => void;
  addPattern: (pattern: PatternKind) => void;
  addImage: (src: string, name: string, alt?: string, decorative?: boolean, location?: ImageElement["location"]) => void;
  addInk: (element: InkElement) => void;
  updateElement: (elementId: string, patch: Partial<SceneElement>, recordHistory?: boolean) => void;
  deleteSelected: () => void;
  duplicateSelected: () => void;
  moveLayer: (direction: "front" | "back") => void;
  undo: () => void;
  redo: () => void;
  publish: (visibility: "unlisted" | "public", versionId?: string) => void;
  resetDemo: () => void;
}

function cloneBook(book: Photobook): Photobook {
  return structuredClone(book);
}

function activePage(state: Pick<BookStore, "book" | "activePageId">): ScenePage {
  return (
    state.book.document.pages.find((page) => page.id === state.activePageId) ??
    state.book.document.pages[0]
  );
}

function withMutation(
  state: BookStore,
  mutation: (book: Photobook) => void,
  options: { select?: string | null; activePageId?: string; history?: boolean } = {},
) {
  const nextBook = cloneBook(state.book);
  mutation(nextBook);
  nextBook.updatedAt = new Date().toISOString();
  return {
    book: nextBook,
    books: state.books.some((book) => book.id === nextBook.id)
      ? state.books.map((book) => book.id === nextBook.id ? cloneBook(nextBook) : book)
      : [...state.books, cloneBook(nextBook)],
    past: options.history === false ? state.past : [...state.past.slice(-39), cloneBook(state.book)],
    future: options.history === false ? state.future : [],
    selectedElementId:
      options.select === undefined ? state.selectedElementId : options.select,
    activePageId: options.activePageId ?? state.activePageId,
    savedAt: new Date().toISOString(),
  };
}

export const useBookStore = create<BookStore>()(
  persist(
    (set, get) => ({
      book: sampleBook,
      books: [sampleBook],
      activePageId: sampleBook.document.pages[0].id,
      selectedElementId: null,
      tool: "select",
      savedAt: new Date().toISOString(),
      past: [],
      future: [],

      setTool: (tool) => set({ tool, selectedElementId: tool === "select" ? get().selectedElementId : null }),
      setActivePage: (activePageId) => set({ activePageId, selectedElementId: null, tool: "select" }),
      selectElement: (selectedElementId) => set({ selectedElementId, tool: "select" }),
      setBookMeta: (patch) => set((state) => withMutation(state, (book) => Object.assign(book, patch))),
      selectBook: (bookId) => {
        const selected = get().books.find((book) => book.id === bookId);
        if (!selected) return;
        set({
          book: cloneBook(selected),
          activePageId: selected.document.pages[0].id,
          selectedElementId: null,
          tool: "select",
          past: [],
          future: [],
        });
      },
      openPublicBook: (book) => set({
        book: cloneBook(book),
        activePageId: book.document.pages[0].id,
        selectedElementId: null,
        tool: "select",
        past: [],
        future: [],
      }),
      createBlankBook: (authorId, authorName, bookId, slug) => {
        const id = bookId ?? createId("book");
        const pageId = createId("page");
        const now = new Date().toISOString();
        const book: Photobook = {
          id,
          slug: slug ?? `book-${id.replace(/[^a-zA-Z0-9-]/g, "-")}`,
          authorId,
          title: "未命名摄影书",
          subtitle: "",
          author: authorName,
          description: "",
          status: "draft",
          aiEnabled: true,
          commentsEnabled: true,
          updatedAt: now,
          document: {
            version: 1,
            backgroundPolicy: "fixed-white",
            pages: [{ id: pageId, name: "页面 1", format: "4:3", width: 1440, height: 1080, background: "#ffffff", transition: "fade", elements: [] }],
          },
        };
        set((state) => ({
          book,
          books: [...state.books, cloneBook(book)],
          activePageId: pageId,
          selectedElementId: null,
          tool: "select",
          savedAt: now,
          past: [],
          future: [],
        }));
        return id;
      },

      addPage: (format = "4:3") => {
        const id = createId("page");
        const size = PAGE_FORMATS[format];
        set((state) =>
          withMutation(
            state,
            (book) => {
              book.document.pages.push({
                id,
                name: `页面 ${book.document.pages.length + 1}`,
                format,
                ...size,
                background: "#ffffff",
                transition: "fade",
                elements: [],
              });
            },
            { activePageId: id, select: null },
          ),
        );
      },

      duplicatePage: (pageId) => {
        const id = createId("page");
        set((state) =>
          withMutation(
            state,
            (book) => {
              const index = book.document.pages.findIndex((page) => page.id === pageId);
              if (index < 0) return;
              const copy = structuredClone(book.document.pages[index]);
              copy.id = id;
              copy.name = `${copy.name} 副本`;
              copy.elements = copy.elements.map((element) => ({ ...element, id: createId(element.type) }));
              book.document.pages.splice(index + 1, 0, copy);
            },
            { activePageId: id, select: null },
          ),
        );
      },

      deletePage: (pageId) => {
        const state = get();
        if (state.book.document.pages.length === 1) return;
        const index = state.book.document.pages.findIndex((page) => page.id === pageId);
        const fallback = state.book.document.pages[Math.max(0, index - 1)]?.id;
        set((current) =>
          withMutation(
            current,
            (book) => {
              book.document.pages = book.document.pages.filter((page) => page.id !== pageId);
            },
            { activePageId: fallback, select: null },
          ),
        );
      },

      movePage: (pageId, targetPageId) =>
        set((state) =>
          withMutation(state, (book) => {
            const from = book.document.pages.findIndex((page) => page.id === pageId);
            const to = book.document.pages.findIndex((page) => page.id === targetPageId);
            if (from < 0 || to < 0 || from === to) return;
            const [page] = book.document.pages.splice(from, 1);
            book.document.pages.splice(to, 0, page);
          }),
        ),

      setPageFormat: (format) =>
        set((state) =>
          withMutation(state, (book) => {
            const page = book.document.pages.find((item) => item.id === state.activePageId);
            if (!page) return;
            const oldWidth = page.width;
            const oldHeight = page.height;
            const next = PAGE_FORMATS[format];
            const scale = Math.min(next.width / oldWidth, next.height / oldHeight);
            page.format = format;
            page.width = next.width;
            page.height = next.height;
            page.background = "#ffffff";
            page.elements = page.elements.map((element) => ({
              ...element,
              x: element.x * scale,
              y: element.y * scale,
              width: element.width * scale,
              height: element.height * scale,
            }));
          }),
        ),

      setPageTransition: (transition) =>
        set((state) =>
          withMutation(state, (book) => {
            const page = book.document.pages.find((item) => item.id === state.activePageId);
            if (page) page.transition = transition;
          }),
        ),

      addText: () => {
        const id = createId("text");
        set((state) =>
          withMutation(
            state,
            (book) => {
              const page = book.document.pages.find((item) => item.id === state.activePageId);
              if (!page) return;
              page.elements.push({
                id,
                type: "text",
                text: "在这里输入文字",
                x: page.width * 0.18,
                y: page.height * 0.2,
                width: page.width * 0.46,
                height: 180,
                rotation: 0,
                opacity: 1,
                fontSize: 48,
                fontFamily: "serif",
                fontWeight: 500,
                color: "#111111",
                align: "left",
                lineHeight: 1.4,
              });
            },
            { select: id },
          ),
        );
      },

      addPattern: (pattern) => {
        const id = createId("pattern");
        set((state) =>
          withMutation(
            state,
            (book) => {
              const page = book.document.pages.find((item) => item.id === state.activePageId);
              if (!page) return;
              page.elements.push({
                id,
                type: "pattern",
                pattern,
                x: page.width * 0.2,
                y: page.height * 0.2,
                width: page.width * 0.34,
                height: page.height * 0.34,
                rotation: 0,
                opacity: 0.85,
                foreground: "#171717",
                background: "transparent",
                spacing: 32,
                scale: 1,
              });
            },
            { select: id },
          ),
        );
      },

      addImage: (src, name, alt = "", decorative = false, location) => {
        const id = createId(decorative ? "decoration" : "image");
        set((state) =>
          withMutation(
            state,
            (book) => {
              const page = book.document.pages.find((item) => item.id === state.activePageId);
              if (!page) return;
              page.elements.push({
                id,
                type: "image",
                src,
                name,
                alt: alt || name,
                decorative,
                x: page.width * 0.15,
                y: page.height * 0.14,
                width: page.width * (decorative ? 0.3 : 0.56),
                height: page.height * (decorative ? 0.3 : 0.56),
                rotation: 0,
                opacity: 1,
                fit: decorative ? "contain" : "cover",
                shape: "rectangle",
                filter: "none",
                location: decorative ? undefined : location ?? { visibility: "hidden" },
              });
            },
            { select: id },
          ),
        );
      },

      addInk: (element) =>
        set((state) =>
          withMutation(
            state,
            (book) => {
              const page = book.document.pages.find((item) => item.id === state.activePageId);
              page?.elements.push(element);
            },
            { select: element.id },
          ),
        ),

      updateElement: (elementId, patch, recordHistory = true) =>
        set((state) =>
          withMutation(
            state,
            (book) => {
              const page = book.document.pages.find((item) => item.id === state.activePageId);
              const element = page?.elements.find((item) => item.id === elementId);
              if (element) Object.assign(element, patch);
            },
            { history: recordHistory },
          ),
        ),

      deleteSelected: () => {
        const id = get().selectedElementId;
        if (!id) return;
        set((state) =>
          withMutation(
            state,
            (book) => {
              const page = book.document.pages.find((item) => item.id === state.activePageId);
              if (page) page.elements = page.elements.filter((item) => item.id !== id);
            },
            { select: null },
          ),
        );
      },

      duplicateSelected: () => {
        const id = get().selectedElementId;
        if (!id) return;
        const newId = createId("element");
        set((state) =>
          withMutation(
            state,
            (book) => {
              const page = book.document.pages.find((item) => item.id === state.activePageId);
              const element = page?.elements.find((item) => item.id === id);
              if (!page || !element) return;
              page.elements.push({ ...structuredClone(element), id: newId, x: element.x + 36, y: element.y + 36 });
            },
            { select: newId },
          ),
        );
      },

      moveLayer: (direction) => {
        const id = get().selectedElementId;
        if (!id) return;
        set((state) =>
          withMutation(state, (book) => {
            const page = book.document.pages.find((item) => item.id === state.activePageId);
            const index = page?.elements.findIndex((item) => item.id === id) ?? -1;
            if (!page || index < 0) return;
            const [element] = page.elements.splice(index, 1);
            page.elements.splice(direction === "front" ? page.elements.length : 0, 0, element);
          }),
        );
      },

      undo: () => {
        const state = get();
        const previous = state.past.at(-1);
        if (!previous) return;
        set({
          book: cloneBook(previous),
          books: state.books.map((book) => book.id === previous.id ? cloneBook(previous) : book),
          past: state.past.slice(0, -1),
          future: [cloneBook(state.book), ...state.future.slice(0, 39)],
          selectedElementId: null,
          activePageId: previous.document.pages.some((page) => page.id === state.activePageId)
            ? state.activePageId
            : previous.document.pages[0].id,
        });
      },

      redo: () => {
        const state = get();
        const next = state.future[0];
        if (!next) return;
        set({
          book: cloneBook(next),
          books: state.books.map((book) => book.id === next.id ? cloneBook(next) : book),
          past: [...state.past.slice(-39), cloneBook(state.book)],
          future: state.future.slice(1),
          selectedElementId: null,
        });
      },

      publish: (visibility, versionId) =>
        set((state) =>
          withMutation(state, (book) => {
            const publishedAt = new Date().toISOString();
            book.status = visibility;
            book.publishedSnapshot = {
              id: versionId ?? createId("version"),
              publishedAt,
              document: structuredClone(book.document),
            };
          }),
        ),

      resetDemo: () =>
        set({
          book: structuredClone(sampleBook),
          books: [structuredClone(sampleBook)],
          activePageId: sampleBook.document.pages[0].id,
          selectedElementId: null,
          tool: "select",
          savedAt: new Date().toISOString(),
          past: [],
          future: [],
        }),
    }),
    {
      name: "white-page-photobook-v3",
      storage: createJSONStorage(() => safeLocalStorage),
      partialize: (state) => ({
        book: state.book,
        books: state.books,
        activePageId: state.activePageId,
        savedAt: state.savedAt,
      }),
    },
  ),
);

export function getActivePage(state: Pick<BookStore, "book" | "activePageId">) {
  return activePage(state);
}
