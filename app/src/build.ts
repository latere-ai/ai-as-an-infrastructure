// Static site generator: compile every chapter of both languages to static HTML
// under _book/{en,zh}, matching the canonical clean chapter paths. Copies figures, emits the
// hydration bundle, wires the runtime scripts (Pyodide runnable, viz, mermaid),
// and writes a search index.

import { renderToString } from "react-dom/server";
import { createElement } from "react";
import Reader from "./Reader.tsx";
import { page } from "./html.ts";
import { loadBook } from "./pipeline/book.ts";
import { compileChapter } from "./pipeline/compile.ts";
import { loadBibliographyDir } from "./pipeline/citations.ts";
import { loadGlossary } from "./pipeline/glossary.ts";
import { buildCrossref } from "./pipeline/crossref.ts";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { buildSearchDocs } from "./pipeline/search.ts";
import { BASE, ogImageUrl } from "./site.ts";
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
// Content hash for cache-busting. reader.js keeps a stable filename (so nginx
// serves it), but the <script src> carries ?v=<hash> so a returning reader's
// browser fetches the new bundle instead of a stale cached one on every deploy.
const clientHash = Bun.hash(clientJs).toString(36).slice(0, 10);

// Reuse the proven runtime scripts (verbatim, framework-free IIFEs) + mermaid.
const runtime = (f: string) => existsSync(join(repoRoot, f)) ? readFileSync(join(repoRoot, f), "utf8") : "";
const mermaidInit = `<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
// The reader calls this after hydration (it owns the article DOM).
window.__rdrMermaid = () => mermaid.run({ querySelector: ".mermaid:not([data-processed='true'])" }).catch(() => {});
if (window.__rdrRuntimesReady) window.__rdrRuntimesReady();
</script>`;
const afterBody = runtime("live-runtime.html") + runtime("viz-runtime.html") + mermaidInit;

const graphviz = await loadGraphviz();
const glossary = loadGlossary(join(repoRoot, "glossary.yml"));

let pageCount = 0;
const pathsByLang: Record<Lang, Set<string>> = { en: new Set(), zh: new Set() };
// English share-card text keyed by chapter href (shared across languages). Filled
// on the en pass and read on the zh pass so zh pages unfurl an English card.
// Relies on en rendering before zh below; the zh lookup falls back gracefully.
const enShare: Record<string, { title: string; description: string }> = {};
const missingCards: string[] = [];

// Social-share cards: vendored as source under app/static/og (generated on
// demand by `make og`), copied into _book/og before the page loop so the
// missing-card check below sees them and the build output is complete.
const ogSrc = join(repoRoot, "app", "static", "og");
if (existsSync(ogSrc)) cpSync(ogSrc, join(outRoot, "og"), { recursive: true });

for (const lang of ["en", "zh"] as Lang[]) {
  const book = loadBook(lang, repoRoot);
  const bib = loadBibliographyDir(join(repoRoot, "refs"));
  const xref = buildCrossref(book);
  const ctx = { bib, xref, graphviz, refsDir: join(repoRoot, "refs"), glossary, glossaryUsed: new Set<string>(), glossaryFirstUses: new Map() };
  const langOut = join(outRoot, lang);
  // Clean the per-language tree before regenerating: a renamed or moved chapter
  // would otherwise leave its old .html behind (stale dead pages, broken-link
  // noise). og/ lives at the book root, not under langOut, so it is preserved.
  rmSync(langOut, { recursive: true, force: true });
  mkdirSync(langOut, { recursive: true });

  // figures (committed SVGs + covers)
  const figSrc = join(repoRoot, lang, "figures");
  if (existsSync(figSrc)) cpSync(figSrc, join(langOut, "figures"), { recursive: true });

  writeFileSync(join(langOut, "reader.js"), clientJs);

  const searchDocs: ReturnType<typeof buildSearchDocs> = [];
  // book order already ends with references.qmd, so cited[] is complete by then.
  for (const ch of book.chapters) {
    const data = compileChapter(book, ch, ctx);
    const bodyHtml = renderToString(createElement(Reader, { chapter: data }));
    const depth = ch.href.split("/").length - 1;
    const clientHref = "../".repeat(depth) + "reader.js?v=" + clientHash;
    // English-only share card (same image + text for en/zh at this path).
    if (lang === "en") enShare[ch.href] = { title: data.title, description: data.description };
    const en = enShare[ch.href] ?? { title: data.title, description: data.description };
    const share = { title: en.title, description: en.description, imageUrl: ogImageUrl(ch.href) };
    if (!existsSync(join(outRoot, "og", ch.href + ".png"))) missingCards.push(ch.href);
    const html = page({ chapter: data, bodyHtml, css, clientHref, afterBody, share });
    // hrefs are extensionless; the file on disk keeps .html (nginx try_files
    // serves the clean URL from it).
    const outPath = join(langOut, ch.href + ".html");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html);
    searchDocs.push(...buildSearchDocs(data, ch.href, lang));
    pathsByLang[lang].add(ch.href === "index" ? "" : ch.href); // clean path for sitemap
    pageCount++;
  }
  writeFileSync(join(langOut, "search.json"), JSON.stringify(searchDocs));
  console.log(`  ${lang}: ${book.chapters.length} pages`);
}

// Root artifacts (served from _book root): favicon, robots, hreflang sitemap.
cpSync(join(repoRoot, "app", "static", "favicon.svg"), join(outRoot, "favicon.svg"));
writeFileSync(join(outRoot, "robots.txt"), `User-agent: *\nAllow: /\nSitemap: ${BASE}/sitemap.xml\n`);

const allPaths = [...new Set([...pathsByLang.en, ...pathsByLang.zh])].sort();
const loc = (lang: string, p: string) => `${BASE}/${lang}/${p}`;
const sitemap = allPaths.map((p) => {
  const langs = (["en", "zh"] as Lang[]).filter((l) => pathsByLang[l].has(p));
  const alts = langs.map((l) => `    <xhtml:link rel="alternate" hreflang="${l === "zh" ? "zh-Hans" : "en"}" href="${loc(l, p)}"/>`);
  if (langs.includes("en")) alts.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${loc("en", p)}"/>`);
  // one <url> per existing language version, each carrying the full alternate set
  return langs.map((l) => `  <url>\n    <loc>${loc(l, p)}</loc>\n${alts.join("\n")}\n  </url>`).join("\n");
}).join("\n");
writeFileSync(join(outRoot, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${sitemap}\n</urlset>\n`);

// Pages reference /og/<href>.png, generated on demand by `make og` and vendored.
// Warn (don't fail) if any are missing so a new/renamed chapter doesn't silently
// ship a broken card; CI stays green since the vendored PNGs are present there.
const missing = [...new Set(missingCards)];
if (missing.length) console.warn(`  ⚠ ${missing.length} share card(s) missing (run \`make og\`): ${missing.join(", ")}`);

console.log(`built ${pageCount} pages into ${outRoot}`);
