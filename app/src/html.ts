// Page template shared by the dev server and the SSG build. Wraps SSR'd shell
// HTML with the head (fonts + KaTeX from CDN, the design's CSS inlined) and the
// hydration data, then the client bundle and after-body runtime scripts.

import type { ChapterData } from "./types.ts";

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
}): string {
  const { chapter, bodyHtml, css, clientHref, afterBody = "" } = opts;
  const title = `${chapter.title} · AI as an Infrastructure`;
  const data = JSON.stringify(chapter).replace(/</g, "\\u003c");
  // Per-language canonical URLs + hreflang so both languages are independently
  // indexable and Google serves the right one. en/zh share the chapter path.
  const BASE = "https://aaai.latere.ai";
  const htmlLang = chapter.lang === "zh" ? "zh-Hans" : "en";
  const url = (lang: string) => `${BASE}/${lang}/${chapter.path}`; // path "" → /<lang>/
  const attr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const desc = chapter.description ? `\n<meta name="description" content="${attr(chapter.description)}">` : "";
  return `<!DOCTYPE html>
<html lang="${htmlLang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>${desc}
<link rel="canonical" href="${url(chapter.lang)}">
<link rel="alternate" hreflang="en" href="${url("en")}">
<link rel="alternate" hreflang="zh-Hans" href="${url("zh")}">
<link rel="alternate" hreflang="x-default" href="${url("en")}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
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
