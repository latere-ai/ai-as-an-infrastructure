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

// A page's absolute address. `path` is the lang-root-relative clean path
// ("" for a language's home page), the same value ChapterData.path carries.
export const pageUrl = (lang: string, path: string) => `${BASE}/${lang}/${path}`;
export const SITE_DESCRIPTION = "The lifecycle of a capability, from compute to deployed, governed behavior.";

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
