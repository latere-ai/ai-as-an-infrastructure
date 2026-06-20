// Shared data model produced by the content pipeline (src/pipeline) and consumed
// by the React shell (Reader.tsx). Kept framework-free so the build and the
// client hydration share one definition.

export type Lang = "en" | "zh";
export type Palette = "ink" | "clay";
export type Theme = "light" | "dark";
export type Layout = "codex" | "manuscript" | "atlas";

export interface NavChapter {
  n: string; // chapter number, e.g. "6" ("" for unnumbered)
  label: string;
  href: string; // root-relative, e.g. "p1-foundations/06-....html"
  active?: boolean;
}

export interface NavPart {
  id: string;
  label: string;
  single?: boolean; // a top-level chapter with no part (Preface, Summary…)
  chapters: NavChapter[];
}

export interface Heading {
  id: string;
  text: string;
  level: number; // 2 or 3
}

export interface PrevNext {
  label: string;
  href: string;
}

export interface ChapterData {
  lang: Lang;
  partLabel: string; // breadcrumb part, e.g. "Part I: Foundations and Pretraining"
  chapterNum: string; // "6" or ""
  eyebrow: string; // "Part 1 · Chapter 6"
  title: string;
  contentHtml: string; // compiled article body
  headings: Heading[];
  prev: PrevNext | null;
  next: PrevNext | null;
  langHref: string; // the same page in the other language
  prefix: string; // "../" * depth, to make lang-root-relative hrefs page-relative
  toc: NavPart[]; // full-book nav
}

export interface ReaderSettings {
  palette: Palette;
  theme: Theme;
  layout: Layout;
  serifBody: boolean;
  fontScale: number;
  navCollapsed: boolean;
  tocCollapsed: boolean;
}

export const DEFAULT_SETTINGS: ReaderSettings = {
  palette: "ink",
  theme: "light",
  layout: "codex",
  serifBody: false,
  fontScale: 1,
  navCollapsed: false,
  tocCollapsed: false,
};
