// PDF + EPUB export (the alternative to Quarto's pdf/epub). For each language we
// assemble all chapters into one document, then:
//   PDF  — headless Chrome --print-to-pdf (renders KaTeX, inline-SVG dot, and
//          mermaid via its client module before printing)
//   EPUB — Chrome dumps the rendered DOM (mermaid now SVG), pandoc → epub
// Outputs are vendored into _book/<lang>/ alongside the HTML. Run on demand:
//   bun run export   (slow; not part of the per-commit hook)

import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { loadBook } from "./pipeline/book.ts";
import { compileChapter } from "./pipeline/compile.ts";
import { loadBibliographyDir } from "./pipeline/citations.ts";
import { buildCrossref } from "./pipeline/crossref.ts";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import ChapterOpenerExport from "./ChapterOpenerExport.tsx";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import type { Lang } from "./types.ts";

const repoRoot = new URL("../../", import.meta.url).pathname;
const outRoot = join(repoRoot, "_book");
const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");
const CHROME = process.env.CHROME ||
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

const PRINT_CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  html, body { height: auto !important; overflow: visible !important; }
  .reader { height: auto !important; overflow: visible !important; display: block !important; font-size: 11.5pt; }
  .pchap { break-before: page; padding: 0 0 8px; }
  .pchap:first-of-type { break-before: avoid; }
  .rdr-article { color: var(--fg-1); max-width: 38em; margin: 0 auto; }
  .rdr-article h2 { break-after: avoid; }
  .rdr-figure, .rdr-diagram, table, pre { break-inside: avoid; }
  .pcover { text-align: center; padding: 30vh 0; break-after: page; }
  .pcover h1 { font-family: var(--font-serif); font-size: 32pt; margin-bottom: 12pt; }
  a { color: inherit; text-decoration: none; }`;

const MERMAID = `<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
await mermaid.run({ querySelector: ".mermaid" }).catch(() => {});
document.title = "READY";
</script>`;

// Namespace ids + same-page anchors per chapter, and flatten cross-page hrefs to
// in-document anchors so the single combined doc links resolve.
function nsChapter(html: string, n: number): string {
  return html
    .replace(/id="([^"]+)"/g, (_m, id) => `id="c${n}-${id}"`)
    .replace(/href="[^"#]*#([^"]+)"/g, (_m, anc) => `href="#c${n}-${anc}"`)
    .replace(/src="(?:\.\.\/)*figures\//g, 'src="figures/');
}

function buildCombined(lang: Lang, bookTitle: string, chaptersHtml: string): string {
  return `<!DOCTYPE html><html lang="${lang}" data-palette="ink" data-theme="light"><head><meta charset="utf-8">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/lxgw-wenkai-tc-webfont@1.0.0/style.css">
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Instrument+Serif:ital@0;1&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<style>${css}\n${PRINT_CSS}</style></head>
<body><div class="reader"><div class="rdr-article-root">
<div class="pcover"><h1>${bookTitle}</h1><div>Changkun Ou · latere.ai</div></div>
${chaptersHtml}
</div></div>${MERMAID}</body></html>`;
}

function run(cmd: string, args: string[]): boolean {
  const r = spawnSync(cmd, args, { stdio: "ignore" });
  return r.status === 0;
}

for (const lang of ["en", "zh"] as Lang[]) {
  const book = loadBook(lang, repoRoot);
  const bib = loadBibliographyDir(join(repoRoot, "refs"));
  const xref = buildCrossref(book);
  const graphviz = await loadGraphviz();
  const langOut = join(outRoot, lang);

  let body = "";
  book.chapters.forEach((ch, i) => {
    const data = compileChapter(book, ch, { bib, xref, graphviz, refsDir: join(repoRoot, "refs") });
    const opener = renderToStaticMarkup(createElement(ChapterOpenerExport, { chapter: data }));
    body += `<section class="pchap">${nsChapter(opener + `<div class="rdr-article">${data.contentHtml}</div>`, i)}</section>\n`;
  });

  const combined = buildCombined(lang, book.title, body);
  const srcPath = join(langOut, "_export.html");
  writeFileSync(srcPath, combined);

  const base = `ai-as-an-infrastructure-${lang}`;
  // PDF: Chrome renders (incl. mermaid via virtual time) then prints.
  const pdfOk = run(CHROME, ["--headless=new", "--disable-gpu", "--no-pdf-header-footer",
    "--virtual-time-budget=45000", `--print-to-pdf=${join(langOut, base + ".pdf")}`, `file://${srcPath}`]);
  // EPUB: dump the rendered DOM (mermaid now SVG), then pandoc → epub.
  const renderedPath = join(langOut, "_rendered.html");
  const dump = spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--virtual-time-budget=45000", "--dump-dom", `file://${srcPath}`], { encoding: "utf8", maxBuffer: 1 << 28 });
  let epubOk = false;
  if (dump.status === 0 && dump.stdout) {
    writeFileSync(renderedPath, dump.stdout);
    epubOk = run("pandoc", [renderedPath, "-f", "html", "-t", "epub3", "--mathml",
      "--metadata", `title=${book.title}`, "--metadata", "author=Changkun Ou", "--metadata", `lang=${lang}`,
      "-o", join(langOut, base + ".epub")]);
    rmSync(renderedPath, { force: true });
  }
  rmSync(srcPath, { force: true });
  console.log(`  ${lang}: pdf=${pdfOk ? "ok" : "FAIL"} epub=${epubOk ? "ok" : "FAIL"} (${book.chapters.length} chapters)`);
}
