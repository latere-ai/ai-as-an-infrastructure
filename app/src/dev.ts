// Bun dev server: SSR the reader shell, bundle the client for hydration, serve
// the page. For shell development and screenshot verification (P0+).

import { renderToString } from "react-dom/server";
import { createElement } from "react";
import Reader from "./Reader.tsx";
import { page } from "./html.ts";
import { loadBook } from "./pipeline/book.ts";
import { compileChapter } from "./pipeline/compile.ts";
import { loadBibliographyDir } from "./pipeline/citations.ts";
import { buildCrossref } from "./pipeline/crossref.ts";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { loadGlossary } from "./pipeline/glossary.ts";
import { DEV_CHAPTER_HREF, figureRequestPath } from "./dev-chapter.ts";
import { buildAfterBody } from "./runtime.ts";
import { join } from "node:path";

const css = await Bun.file(new URL("./theme.css", import.meta.url)).text();
const repoRoot = new URL("../../", import.meta.url).pathname;
const book = loadBook("en", repoRoot);
const glossary = loadGlossary(join(repoRoot, "glossary.yml"));
const ctx = { bib: loadBibliographyDir(join(repoRoot, "refs")), xref: buildCrossref(book), graphviz: await loadGraphviz(), refsDir: join(repoRoot, "refs"), glossary, glossaryUsed: new Set<string>(), glossaryFirstUses: new Map() };
const sampleChapter = book.chapters.find((c) => c.href === DEV_CHAPTER_HREF);
if (!sampleChapter) {
  throw new Error(`dev server: sample chapter "${DEV_CHAPTER_HREF}" not found in en book.yml (see dev-chapter.ts)`);
}
const devChapter = compileChapter(book, sampleChapter, ctx);
// Same runtime scripts the static build injects, so runnable cells, viz
// components, and mermaid diagrams work in dev too.
const afterBody = buildAfterBody(repoRoot);

async function buildClient(): Promise<string> {
  const out = await Bun.build({
    entrypoints: [new URL("./hydrate.tsx", import.meta.url).pathname],
    target: "browser",
    minify: false,
    define: { "process.env.NODE_ENV": '"production"' },
  });
  if (!out.success) {
    console.error(out.logs);
    throw new Error("client build failed");
  }
  return await out.outputs[0].text();
}

let clientJs = await buildClient();

const port = Number(process.env.PORT ?? 4321);
Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url);
    const fig = figureRequestPath(url.pathname);
    if (fig !== null) {
      const f = Bun.file(join(repoRoot, "en", "figures", fig));
      return (await f.exists()) ? new Response(f) : new Response("not found", { status: 404 });
    }
    if (url.pathname === "/client.js") {
      clientJs = await buildClient(); // rebuild each load in dev
      return new Response(clientJs, { headers: { "content-type": "text/javascript" } });
    }
    const bodyHtml = renderToString(createElement(Reader, { chapter: devChapter }));
    const html = page({ chapter: devChapter, bodyHtml, css, clientHref: "/client.js", afterBody });
    return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
  },
});

console.log(`reader dev server on http://localhost:${port}`);
