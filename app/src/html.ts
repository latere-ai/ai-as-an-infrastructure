// Page template shared by the dev server and the SSG build. Wraps SSR'd shell
// HTML with the head (fonts from CDN, the design's CSS) and the hydration data.

import type { ChapterData } from "./types.ts";

const FONT_LINKS = `
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-tc-webfont@1.0.0/style.css">`;

export function page(opts: {
  chapter: ChapterData;
  bodyHtml: string;
  css: string;
  clientSrc: string; // path to hydration bundle, or inline via clientInline
  clientInline?: string;
}): string {
  const { chapter, bodyHtml, css, clientSrc, clientInline } = opts;
  const title = `${chapter.title} · AI as an Infrastructure`;
  const data = JSON.stringify(chapter).replace(/</g, "\\u003c");
  return `<!DOCTYPE html>
<html lang="${chapter.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
${FONT_LINKS}
<style>${css}</style>
</head>
<body>
<div id="root">${bodyHtml}</div>
<script>window.__CHAPTER__ = ${data};</script>
${clientInline ? `<script type="module">${clientInline}</script>` : `<script type="module" src="${clientSrc}"></script>`}
</body>
</html>`;
}
