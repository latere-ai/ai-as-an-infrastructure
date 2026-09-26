// Canonical site identity, shared by the HTML head (html.ts), the SSG build
// (build.ts: share images, the agentweb.json page index), the title page
// (landing.ts), and the social-card generator (og.ts). One source of truth for
// the production origin and book metadata.

import type { Lang } from "./types.ts";

export const BASE = "https://aaai.latere.ai";
export const SITE_NAME = "AI as an Infrastructure";
export const AUTHOR = "Changkun Ou";
export const AUTHOR_URL = "https://changkun.de";
export const PUBLISHER = "Latere AI";
export const PUBLISHER_URL = "https://latere.ai";

// The book's license, named on the title page and in every page's Markdown
// twin, with the Creative Commons deed that states its terms.
export const LICENSE = "CC BY-NC-ND 4.0";
export const LICENSE_URL = "https://creativecommons.org/licenses/by-nc-nd/4.0/";

// A page's origin-relative and absolute address. `path` is the
// lang-root-relative clean path ("" for a language's home page), the same
// value ChapterData.path carries.
export const pagePath = (lang: string, path: string) => `/${lang}/${path}`;
export const pageUrl = (lang: string, path: string) => BASE + pagePath(lang, path);

// A page's Markdown twin, written beside its HTML: the home page's is
// /<lang>/index.md, every other page's is its clean path plus ".md".
export const markdownPath = (lang: string, path: string) => `/${lang}/${path || "index"}.md`;

export const SITE_DESCRIPTION = "The lifecycle of a capability, from compute to deployed, governed behavior.";

// One paragraph per language on what the book is, for descriptions of the
// book as a whole rather than one page: agentweb.json and the llms.txt of each
// language the server generates from it, and the Book node in each home
// page's structured data.
export const BOOK_SUMMARY: Record<Lang, string> = {
  en:
    "A book that treats AI as an infrastructure and explains it design-first. " +
    "It follows one capability through its lifecycle, from raw compute and corpus construction " +
    "to a deployed behavior that can be measured, constrained, and operated, and at each layer asks " +
    "how the mechanism got its shape, what trade-offs that shape encodes, and what theory lies underneath. " +
    "It is written for software engineers who know systems and distributed computing but are new to " +
    "machine learning. The English and Chinese editions carry the same chapters, sources, equations, and figures.",
  zh:
    "本书把人工智能当作一种基础设施，从设计出发来讲解。" +
    "全书沿着一项能力的生命周期展开：从原始算力和语料构建开始，一直写到这种能力部署后成为可测量、可约束、可运营的系统行为。" +
    "每一层都追问三件事：这套机制为什么会形成今天的样子，这种形态包含了哪些取舍，背后又有什么理论。" +
    "本书写给熟悉系统与分布式计算、但初次接触机器学习的软件工程师。" +
    "中英文两个版本的章节、文献来源、公式和图表一一对应。",
};

// Social share cards are 1200x630 (the de-facto Open Graph / Twitter
// "summary_large_image" size). Generated on demand by `make og`, vendored under
// _book/og/<href>.png, and referenced absolutely from every page's head. Cards
// are English-only, so en and zh at the same chapter path share one image.
export const OG_W = 1200;
export const OG_H = 630;

// Absolute URL of a chapter's share card. `href` is the lang-root-relative
// chapter path ("index" for the home page), matching the PNG filename og.ts
// writes. Social scrapers require an absolute og:image, hence the BASE prefix.
export const ogImageUrl = (href: string) => `${BASE}/og/${href}.png`;
