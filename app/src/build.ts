// Static site generator: compile every chapter of both languages to static HTML
// under _book/{en,zh}, matching the paths Quarto produced (so the existing
// nginx/Docker/K8s deploy serves it unchanged). Copies figures, emits the
// hydration bundle, wires the runtime scripts (Pyodide runnable, viz, mermaid),
// and writes a search index.

import { renderToString } from "react-dom/server";
import { createElement } from "react";
import Reader from "./Reader.tsx";
import { page } from "./html.ts";
import { loadBook } from "./pipeline/book.ts";
import { compileChapter } from "./pipeline/compile.ts";
import { loadBibliography } from "./pipeline/citations.ts";
import { buildCrossref } from "./pipeline/crossref.ts";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { buildSearchDoc } from "./pipeline/search.ts";
import { mkdirSync, writeFileSync, cpSync, readFileSync, existsSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Lang } from "./types.ts";

const repoRoot = new URL("../../", import.meta.url).pathname;
const outRoot = join(repoRoot, "_book");
const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

// Build the client hydration bundle once (shared by every page).
const built = await Bun.build({
  entrypoints: [new URL("./hydrate.tsx", import.meta.url).pathname],
  target: "browser", minify: true,
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!built.success) { console.error(built.logs); process.exit(1); }
const clientJs = await built.outputs[0].text();

// Reuse the proven runtime scripts (verbatim, framework-free IIFEs) + mermaid.
const runtime = (f: string) => existsSync(join(repoRoot, f)) ? readFileSync(join(repoRoot, f), "utf8") : "";
const mermaidInit = `<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
mermaid.run({ querySelector: ".mermaid" }).catch(() => {});
</script>`;
const afterBody = runtime("live-runtime.html") + runtime("viz-runtime.html") + mermaidInit;

const graphviz = await loadGraphviz();

let pageCount = 0;
for (const lang of ["en", "zh"] as Lang[]) {
  const book = loadBook(lang, repoRoot);
  const bib = loadBibliography(join(repoRoot, "references.bib"));
  const xref = buildCrossref(book);
  const ctx = { bib, xref, graphviz };
  const langOut = join(outRoot, lang);
  mkdirSync(langOut, { recursive: true });

  // figures (committed SVGs + covers)
  const figSrc = join(repoRoot, lang, "figures");
  if (existsSync(figSrc)) cpSync(figSrc, join(langOut, "figures"), { recursive: true });

  writeFileSync(join(langOut, "reader.js"), clientJs);

  const searchDocs: ReturnType<typeof buildSearchDoc>[] = [];
  // book order already ends with references.qmd, so cited[] is complete by then.
  for (const ch of book.chapters) {
    const data = compileChapter(book, ch, ctx);
    const bodyHtml = renderToString(createElement(Reader, { chapter: data }));
    const depth = ch.href.split("/").length - 1;
    const clientHref = "../".repeat(depth) + "reader.js";
    const html = page({ chapter: data, bodyHtml, css, clientHref, afterBody });
    const outPath = join(langOut, ch.href);
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html);
    searchDocs.push(buildSearchDoc(data, ch.href));
    pageCount++;
  }
  writeFileSync(join(langOut, "search.json"), JSON.stringify(searchDocs));
  console.log(`  ${lang}: ${book.chapters.length} pages`);
}

console.log(`built ${pageCount} pages into ${outRoot}`);
