// Static site generator: compile every chapter of both languages to static HTML
// under _book/{en,zh}, matching the canonical clean chapter paths. Copies figures, emits the
// hydration bundle (which carries the Pyodide runnable, viz, and figure
// runtimes), and writes a search index. Every page also gets a Markdown twin
// beside its HTML (twin.ts) for agents and tools that read text.

import { renderToString } from "react-dom/server";
import { createElement } from "react";
import Reader from "./Reader.tsx";
import { page, notFoundPage } from "./html.ts";
import { loadBook } from "./pipeline/book.ts";
import { compileChapter } from "./pipeline/compile.ts";
import { loadBibliographyDir } from "./pipeline/citations.ts";
import { loadGlossary } from "./pipeline/glossary.ts";
import { buildCrossref } from "./pipeline/crossref.ts";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { buildSearchDocs } from "./pipeline/search.ts";
import { BASE, ogImageUrl } from "./site.ts";
import { markdownTwin, twinInput } from "./twin.ts";
import { mkdirSync, writeFileSync, cpSync, readFileSync, existsSync, rmSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import type { Lang } from "./types.ts";

const repoRoot = new URL("../../", import.meta.url).pathname;
const outRoot = join(repoRoot, "_book");
const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

// Build the client hydration bundle once (shared by every page). Code
// splitting puts each figure module in its own chunk, loaded on demand by the
// pages that embed it. Every file is named by its content hash, so a deploy
// never serves a stale bundle. The entry must be loaded by its plain file name
// (no ?v= query): chunks import it back as "./reader-<hash>.js", and a second
// URL for the same file would evaluate the app twice and hydrate the page twice.
const built = await Bun.build({
  entrypoints: [new URL("./hydrate.tsx", import.meta.url).pathname],
  target: "browser", minify: true, splitting: true,
  naming: { entry: "reader-[hash].[ext]", chunk: "chunk-[hash].[ext]" },
  define: { "process.env.NODE_ENV": '"production"' },
});
if (!built.success) { console.error(built.logs); process.exit(1); }
const clientOutputs = await Promise.all(built.outputs.map(async (o) => ({ name: o.path.replace(/^\.\//, ""), kind: o.kind, text: await o.text() })));
const clientEntry = clientOutputs.find((o) => o.kind === "entry-point")!.name;

const graphviz = await loadGraphviz();
const glossary = loadGlossary(join(repoRoot, "glossary.yml"));

// Both manifests up front: a page's twin names the other language's page only
// when that page exists.
const books = { en: loadBook("en", repoRoot), zh: loadBook("zh", repoRoot) };
const hrefsByLang: Record<Lang, Set<string>> = { en: new Set(books.en.chapters.map((c) => c.href)), zh: new Set(books.zh.chapters.map((c) => c.href)) };

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
  const book = books[lang];
  const other: Lang = lang === "en" ? "zh" : "en";
  const bib = loadBibliographyDir(join(repoRoot, "refs"));
  const xref = buildCrossref(book);
  const ctx = { bib, xref, graphviz, refsDir: join(repoRoot, "refs"), glossary, glossaryUsed: new Set<string>(), glossaryFirstUses: new Map() };
  const langOut = join(outRoot, lang);
  // Clean the per-language tree before regenerating: a renamed or moved chapter
  // would otherwise leave its old .html behind (stale dead pages, broken-link
  // noise). og/ lives at the book root, not under langOut, so it is preserved.
  rmSync(langOut, { recursive: true, force: true });
  mkdirSync(langOut, { recursive: true });

  // figures (committed SVGs)
  const figSrc = join(repoRoot, lang, "figures");
  if (existsSync(figSrc)) cpSync(figSrc, join(langOut, "figures"), { recursive: true });

  for (const o of clientOutputs) writeFileSync(join(langOut, o.name), o.text);

  const searchDocs: ReturnType<typeof buildSearchDocs> = [];
  // book order already ends with references.qmd, so cited[] is complete by then.
  for (const ch of book.chapters) {
    const data = compileChapter(book, ch, ctx);
    const bodyHtml = renderToString(createElement(Reader, { chapter: data }));
    const clientHref = `/${lang}/${clientEntry}`;
    // English-only share card (same image + text for en/zh at this path).
    if (lang === "en") enShare[ch.href] = { title: data.title, description: data.description };
    const en = enShare[ch.href] ?? { title: data.title, description: data.description };
    const share = { title: en.title, description: en.description, imageUrl: ogImageUrl(ch.href) };
    if (!existsSync(join(outRoot, "og", ch.href + ".png"))) missingCards.push(ch.href);
    const html = page({ chapter: data, bodyHtml, css, clientHref, share });
    // hrefs are extensionless; the file on disk keeps .html (nginx try_files
    // serves the clean URL from it).
    const outPath = join(langOut, ch.href + ".html");
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html);
    // The Markdown twin sits beside the HTML at the same clean path plus ".md"
    // (index.md for the home page).
    writeFileSync(join(langOut, ch.href + ".md"), markdownTwin(twinInput(book, ch, data, hrefsByLang[other])));
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
// Served by the Go server, status 404, for content URLs that match nothing.
writeFileSync(join(outRoot, "404.html"), notFoundPage({ css }));

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

// Precompressed siblings: the server streams name.gz to clients that accept
// gzip, so no response is compressed, or copied into memory, per request.
// Files under 1 KiB gain nothing from compression and are left alone.
const GZ = /\.(html|md|css|js|json|svg|xml|txt)$/;
let gzipped = 0;
const compressTree = (dir: string) => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { compressTree(p); continue; }
    if (!GZ.test(e.name)) continue;
    const body = readFileSync(p);
    if (body.length < 1024) continue;
    writeFileSync(p + ".gz", Bun.gzipSync(body, { level: 9 }));
    gzipped++;
  }
};
compressTree(outRoot);

console.log(`built ${pageCount} pages into ${outRoot} (${gzipped} precompressed)`);
