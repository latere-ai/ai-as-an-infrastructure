// Canonical site identity, shared by the HTML head (html.ts), the SSG build
// (build.ts: sitemap/robots/share images), the title page (landing.ts), and
// the social-card generator (og.ts). One source of truth for the production
// origin and book metadata.

export const BASE = "https://aaai.latere.ai";
export const SITE_NAME = "AI as an Infrastructure";
export const AUTHOR = "Changkun Ou";

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

// One paragraph on what the book is, for indexes that describe the site as a
// whole rather than one page (agentweb.json, and the llms.txt served from it).
export const SITE_SUMMARY =
  "A book that treats AI as an infrastructure and explains it design-first. " +
  "It follows one capability through its lifecycle, from raw compute and corpus construction " +
  "to a deployed behavior that can be measured, constrained, and operated, and at each layer asks " +
  "how the mechanism got its shape, what trade-offs that shape encodes, and what theory lies underneath. " +
  "It is written for software engineers who know systems and distributed computing but are new to " +
  "machine learning. The English and Chinese editions carry the same chapters, sources, equations, and figures.";

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
