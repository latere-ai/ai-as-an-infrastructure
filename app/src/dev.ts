// Bun dev server: route by URL and SSR the requested chapter on demand (both
// languages, full nav), bundle the client for hydration, and inject the same
// runtime scripts the static build does. Mirrors the deployed layout so
// navigation, prev/next, and the language switch work, with a hot client
// rebuild on every /client.js load.

import { renderToString } from "react-dom/server";
import { createElement } from "react";
import Reader from "./Reader.tsx";
import { page } from "./html.ts";
import { loadBook, type Book } from "./pipeline/book.ts";
import { compileChapter } from "./pipeline/compile.ts";
import { loadBibliographyDir } from "./pipeline/citations.ts";
import { buildCrossref } from "./pipeline/crossref.ts";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { loadGlossary } from "./pipeline/glossary.ts";
import { resolveDevRoute } from "./dev-router.ts";
import { buildAfterBody } from "./runtime.ts";
import type { Lang } from "./types.ts";
import { join } from "node:path";

const css = await Bun.file(new URL("./theme.css", import.meta.url)).text();
const repoRoot = new URL("../../", import.meta.url).pathname;

// Shared compile inputs, loaded once. The per-compile glossary tracking sets are
// created fresh per request so chapters don't bleed first-use state into each other.
const books: Record<Lang, Book> = { en: loadBook("en", repoRoot), zh: loadBook("zh", repoRoot) };
const glossary = loadGlossary(join(repoRoot, "glossary.yml"));
const bib = loadBibliographyDir(join(repoRoot, "refs"));
const graphviz = await loadGraphviz();
const xref: Record<Lang, ReturnType<typeof buildCrossref>> = { en: buildCrossref(books.en), zh: buildCrossref(books.zh) };
const ctxFor = (lang: Lang) => ({
  bib, xref: xref[lang], graphviz, refsDir: join(repoRoot, "refs"),
  glossary, glossaryUsed: new Set<string>(), glossaryFirstUses: new Map(),
});

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

function renderPage(lang: Lang, href: string): Response {
  const book = books[lang];
  const ch = book.chapters.find((c) => c.href === href);
  if (!ch) return new Response(`not found: ${lang}/${href}`, { status: 404 });
  const data = compileChapter(book, ch, ctxFor(lang));
  const bodyHtml = renderToString(createElement(Reader, { chapter: data }));
  const html = page({ chapter: data, bodyHtml, css, clientHref: "/client.js", afterBody });
  return new Response(html, { headers: { "content-type": "text/html; charset=utf-8" } });
}

const port = Number(process.env.PORT ?? 4321);
Bun.serve({
  port,
  async fetch(req) {
    const route = resolveDevRoute(new URL(req.url).pathname);
    switch (route.kind) {
      case "client":
        clientJs = await buildClient(); // rebuild each load in dev
        return new Response(clientJs, { headers: { "content-type": "text/javascript" } });
      case "figure": {
        const f = Bun.file(join(repoRoot, route.lang, "figures", route.file));
        return (await f.exists()) ? new Response(f) : new Response("not found", { status: 404 });
      }
      case "redirect":
        return Response.redirect(route.to, 302);
      case "page":
        return renderPage(route.lang, route.href);
    }
  },
});

console.log(`reader dev server on http://localhost:${port}`);
