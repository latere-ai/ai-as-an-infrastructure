// Page template shared by the dev server and the SSG build. Wraps SSR'd shell
// HTML with the head (fonts + KaTeX from CDN, the design's CSS inlined) and the
// hydration data, then the client bundle and after-body runtime scripts.

import type { ChapterData } from "./types.ts";
import { DEFAULT_SETTINGS } from "./types.ts";
import { SITE_NAME, AUTHOR, OG_W, OG_H, SITE_DESCRIPTION, ogImageUrl, pageUrl } from "./site.ts";

// Applied before first paint so a returning reader's saved theme/palette/layout
// (the CSS keys off data-theme/data-palette/data-layout on <html>) is set before
// the body paints, killing the light->dark flash and the article-width jump on
// reload. Inlined and blocking on purpose.
const THEME_SCRIPT =
  `<script>(function(){try{var s=JSON.parse(localStorage.getItem("aaai-reader-settings"));` +
  `if(s){var d=document.documentElement;` +
  `if(s.theme)d.setAttribute("data-theme",s.theme);` +
  `if(s.palette)d.setAttribute("data-palette",s.palette);` +
  `if(s.layout)d.setAttribute("data-layout",s.layout);}}catch(e){}})()</script>`;

const FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-tc-webfont@1.0.0/style.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">`;

export function page(opts: {
  chapter: ChapterData;
  bodyHtml: string;
  css: string;
  clientHref: string; // root-relative path to the hydration bundle
  // English share-card text (title + description) and image, used verbatim for
  // the Open Graph / Twitter tags so a shared link unfurls an English card even
  // on zh pages. Omitted by the dev server, which falls back to the page itself.
  share?: { title: string; description: string; imageUrl: string };
}): string {
  const { chapter, bodyHtml, css, clientHref } = opts;
  const isHome = chapter.path === "";
  const title = isHome ? SITE_NAME : `${chapter.title} · ${SITE_NAME}`;
  const data = JSON.stringify(chapter).replace(/</g, "\\u003c");
  // Per-language canonical URLs + hreflang so both languages are independently
  // indexable and Google serves the right one. en/zh share the chapter path.
  const htmlLang = chapter.lang === "zh" ? "zh-Hans" : "en";
  const url = (lang: string) => pageUrl(lang, chapter.path); // path "" → /<lang>/
  const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const desc = chapter.description ? `\n<meta name="description" content="${attr(chapter.description)}">` : "";

  // Social share card. Always English (the user-facing requirement): the card
  // title/description come from the English twin via `share`; the home page is a
  // "website", inner pages "article". The PNG is generated on demand by `make og`.
  const ogHref = isHome ? "index" : chapter.path;
  const card = {
    title: isHome ? SITE_NAME : (opts.share?.title ?? chapter.title),
    description: isHome ? SITE_DESCRIPTION : (opts.share?.description ?? chapter.description),
    imageUrl: opts.share?.imageUrl ?? ogImageUrl(ogHref),
  };
  const ogType = isHome ? "website" : "article";
  const social = [
    `<meta property="og:type" content="${ogType}">`,
    `<meta property="og:site_name" content="${attr(SITE_NAME)}">`,
    `<meta property="og:title" content="${attr(card.title)}">`,
    card.description ? `<meta property="og:description" content="${attr(card.description)}">` : "",
    `<meta property="og:url" content="${url(chapter.lang)}">`,
    `<meta property="og:locale" content="en_US">`,
    `<meta property="og:image" content="${card.imageUrl}">`,
    `<meta property="og:image:type" content="image/png">`,
    `<meta property="og:image:width" content="${OG_W}">`,
    `<meta property="og:image:height" content="${OG_H}">`,
    `<meta property="og:image:alt" content="${attr(`${card.title} · ${SITE_NAME}`)}">`,
    ogType === "article" ? `<meta property="article:author" content="${attr(AUTHOR)}">` : "",
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${attr(card.title)}">`,
    card.description ? `<meta name="twitter:description" content="${attr(card.description)}">` : "",
    `<meta name="twitter:image" content="${card.imageUrl}">`,
    `<meta name="twitter:image:alt" content="${attr(`${card.title} · ${SITE_NAME}`)}">`,
  ].filter(Boolean).join("\n");

  return `<!DOCTYPE html>
<html lang="${htmlLang}" data-theme="${DEFAULT_SETTINGS.theme}" data-palette="${DEFAULT_SETTINGS.palette}" data-layout="${DEFAULT_SETTINGS.layout}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
${THEME_SCRIPT}
<title>${title}</title>${desc}
<meta name="author" content="${attr(AUTHOR)}">
<link rel="canonical" href="${url(chapter.lang)}">
<link rel="alternate" hreflang="en" href="${url("en")}">
<link rel="alternate" hreflang="zh-Hans" href="${url("zh")}">
<link rel="alternate" hreflang="x-default" href="${url("en")}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
${social}
<script>document.cookie="lang=${chapter.lang};path=/;max-age=31536000;samesite=lax"</script>
${FONT_LINKS}
<style>${css}</style>
</head>
<body>
<div id="root">${bodyHtml}</div>
<script>window.__CHAPTER__ = ${data};</script>
<script type="module" src="${clientHref}"></script>
</body>
</html>`;
}

// The page the server answers with, status 404, for a content URL that matches
// nothing. It is served at whatever address was requested, so every link and
// resource is absolute: a relative link resolved against an invented path is
// how a crawler composes the next invented path. It carries no reader bundle,
// no canonical URL, and noindex, and it does not set the language cookie.
export function notFoundPage(opts: { css: string }): string {
  const style = `
.nf{min-height:100vh;display:grid;place-items:center;padding:24px 16px;font-family:var(--font-ui);color:var(--fg-1)}
.nf-card{width:100%;max-width:460px}
.nf-site{font-family:var(--font-serif);font-size:20px;color:var(--fg-2);text-decoration:none}
.nf-site:hover{color:var(--fg-1)}
.nf-code{margin-top:40px;font:500 13px var(--font-mono);letter-spacing:.06em;color:var(--fg-3)}
.nf h1,.nf h2{font-family:var(--font-serif);font-weight:400;line-height:1.15}
.nf h1{font-size:40px;margin:6px 0 10px}
.nf h2{font-family:var(--font-cjk);font-size:26px;margin-bottom:8px}
.nf p{color:var(--fg-2);line-height:1.6}
.nf-zh{margin-top:28px;padding-top:24px;border-top:1px solid var(--border)}
.nf-zh p{font-family:var(--font-cjk)}
.nf-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:32px}
.nf-links a{padding:9px 16px;border:1px solid var(--border-strong);border-radius:var(--radius-md);background:var(--bg-surface);color:var(--fg-1);font-size:14px;font-weight:500;text-decoration:none}
.nf-links a:hover{background:var(--bg-raised)}
.nf-links a[lang]{font-family:var(--font-cjk)}`;
  return `<!DOCTYPE html>
<html lang="en" data-theme="${DEFAULT_SETTINGS.theme}" data-palette="${DEFAULT_SETTINGS.palette}" data-layout="${DEFAULT_SETTINGS.layout}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
${THEME_SCRIPT}
<title>Page not found · ${SITE_NAME}</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
${FONT_LINKS}
<style>${opts.css}${style}</style>
</head>
<body>
<main class="nf">
<div class="nf-card">
<a class="nf-site" href="/en/">${SITE_NAME}</a>
<p class="nf-code">404</p>
<h1>Page not found</h1>
<p>No page exists at this address.</p>
<div class="nf-zh" lang="zh-Hans">
<h2>页面不存在</h2>
<p>此地址没有对应的页面。</p>
</div>
<nav class="nf-links">
<a href="/en/">English edition</a>
<a href="/zh/" lang="zh-Hans">中文版</a>
</nav>
</div>
</main>
</body>
</html>`;
}
