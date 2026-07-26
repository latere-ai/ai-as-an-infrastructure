// Page template shared by the dev server and the SSG build. Wraps SSR'd shell
// HTML with the head (fonts + KaTeX from CDN, the design's CSS inlined) and the
// hydration data, then the client bundle and after-body runtime scripts.

import type { ChapterData } from "./types.ts";
import { DEFAULT_SETTINGS } from "./types.ts";
import { BASE, SITE_NAME, AUTHOR, OG_W, OG_H, SITE_DESCRIPTION, ogImageUrl } from "./site.ts";

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
  clientHref: string; // relative path to the hydration bundle
  afterBody?: string; // raw runtime <script> blocks
  // English share-card text (title + description) and image, used verbatim for
  // the Open Graph / Twitter tags so a shared link unfurls an English card even
  // on zh pages. Omitted by the dev server, which falls back to the page itself.
  share?: { title: string; description: string; imageUrl: string };
}): string {
  const { chapter, bodyHtml, css, clientHref, afterBody = "" } = opts;
  const isHome = chapter.path === "";
  const title = isHome ? SITE_NAME : `${chapter.title} · ${SITE_NAME}`;
  const data = JSON.stringify(chapter).replace(/</g, "\\u003c");
  // Per-language canonical URLs + hreflang so both languages are independently
  // indexable and Google serves the right one. en/zh share the chapter path.
  const htmlLang = chapter.lang === "zh" ? "zh-Hans" : "en";
  const url = (lang: string) => `${BASE}/${lang}/${chapter.path}`; // path "" → /<lang>/
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
${afterBody}
</body>
</html>`;
}
