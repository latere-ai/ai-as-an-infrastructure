// Canonical site identity, shared by the HTML head (html.ts), the SSG build
// (build.ts: sitemap/robots/share images), and the social-card generator
// (og.ts). One source of truth for the production origin and book metadata.

export const BASE = "https://aaai.latere.ai";
export const SITE_NAME = "AI as an Infrastructure";
export const AUTHOR = "Changkun Ou";

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
