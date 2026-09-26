// Every page's head describes the page in schema.org JSON-LD, written at
// build time: the home page of each language as that edition's Book, every
// other page as a Chapter of it with its breadcrumb, and the two languages
// linked as a work and its translation. The head also names the page's
// Markdown twin and its license. The checks are on structure: the JSON parses,
// the fields are present and agree with the page, and every URL the data or
// the links name is a page or file the build wrote. None depends on wording.

import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { page, type PageFacts } from "./html.ts";
import { loadBook } from "./pipeline/book.ts";
import { AUTHOR, BASE, LICENSE_URL, markdownPath, pageUrl } from "./site.ts";
import type { ChapterData, Lang } from "./types.ts";

const repoRoot = join(import.meta.dir, "../..");
const outRoot = join(repoRoot, "_book");
const langs: Lang[] = ["en", "zh"];
const LANG_TAG: Record<Lang, string> = { en: "en", zh: "zh-Hans" };
const built = existsSync(join(outRoot, "en", "index.html"));

type Node = Record<string, any>;

// The JSON-LD script elements in a page's head, parsed.
function jsonLd(html: string): Node[] {
  const head = html.slice(0, html.indexOf("</head>"));
  return [...head.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}

// The file the server answers an absolute page URL from.
function builtFile(url: string): string {
  expect(url.startsWith(BASE + "/")).toBe(true);
  const path = url.slice(BASE.length + 1);
  return join(outRoot, path.endsWith("/") ? `${path}index.html` : `${path}.html`);
}

function headLink(html: string, attrs: string): string | undefined {
  const m = new RegExp(`<link ${attrs} href="([^"]+)">`).exec(html);
  return m?.[1];
}

const fixture: ChapterData = {
  lang: "en", partLabel: "Part I: Base Model Formation", partShort: "Part I", chapterNum: "3",
  isPartIntro: false, eyebrow: "Part I · Chapter 3", crumbChapter: "Chapter 3",
  title: "Scaling Laws", author: AUTHOR, updated: "2026-06-01",
  readtime: "~14 min", contentHtml: "<p>body</p>", headings: [], prev: null, next: null,
  langHref: "/zh/foundations/scaling-laws", prefix: "/en/", path: "foundations/scaling-laws", sourcePath: "en/foundations/03-scaling-laws.qmd",
  description: "First paragraph.", toc: [],
};
const facts: PageFacts = {
  titles: { en: "Book", zh: "书" },
  reviewed: "2026-09-20",
  translation: "扩展律",
  part: { name: "Part I: Base Model Formation", path: "foundations" },
};
const render = (chapter: ChapterData, f?: PageFacts) => page({ chapter, bodyHtml: "", css: "", clientHref: "/en/reader.js", facts: f });

test("a chapter page is a Chapter of its language's Book, with its breadcrumb", () => {
  const [ld] = jsonLd(render(fixture, facts));
  expect(ld["@context"]).toBe("https://schema.org");
  const [ch, crumbs] = ld["@graph"];
  expect(ch["@type"]).toBe("Chapter");
  expect(ch.url).toBe(pageUrl("en", fixture.path));
  expect(ch.position).toBe(3);
  expect(ch.inLanguage).toBe("en");
  expect(ch.isPartOf["@id"]).toBe(pageUrl("en", ""));
  expect(ch.author.name).toBe(AUTHOR);
  expect(ch.license).toBe(LICENSE_URL);
  expect(ch.dateModified).toBe(facts.reviewed);
  expect(ch.workTranslation.url).toBe(pageUrl("zh", fixture.path));
  expect(ch.translationOfWork).toBeUndefined();
  expect(crumbs["@type"]).toBe("BreadcrumbList");
  expect(crumbs.itemListElement.map((i: Node) => i.item)).toEqual([pageUrl("en", ""), pageUrl("en", "foundations"), undefined]);
});

test("a Chinese page names its English source; a page without a translation names none", () => {
  const [zh] = jsonLd(render({ ...fixture, lang: "zh" }, facts));
  expect(zh["@graph"][0].translationOfWork.url).toBe(pageUrl("en", fixture.path));
  expect(zh["@graph"][0].workTranslation).toBeUndefined();
  expect(zh["@graph"][0].inLanguage).toBe("zh-Hans");

  const [alone] = jsonLd(render({ ...fixture, chapterNum: "" }, { ...facts, translation: null, reviewed: "", part: null }));
  const ch = alone["@graph"][0];
  for (const absent of ["workTranslation", "translationOfWork", "position", "dateModified"]) expect(ch[absent]).toBeUndefined();
  expect(alone["@graph"][1].itemListElement.length).toBe(2);
});

test("the dev server's pages, rendered without facts, carry no structured data", () => {
  expect(jsonLd(render(fixture))).toEqual([]);
});

test("every page's head names its Markdown twin and its license", () => {
  for (const f of [facts, undefined]) {
    const html = render(fixture, f);
    expect(headLink(html, 'rel="alternate" type="text/markdown"')).toBe(markdownPath("en", fixture.path));
    expect(headLink(html, 'rel="license"')).toBe(LICENSE_URL);
  }
});

// The built pages of both manifests, with the chapter data each one embeds.
function builtPages(): { lang: Lang; path: string; html: string; data: ChapterData }[] {
  const out = [];
  for (const lang of langs) {
    for (const ch of loadBook(lang, repoRoot).chapters) {
      const path = ch.href === "index" ? "" : ch.href;
      const html = readFileSync(join(outRoot, lang, `${ch.href}.html`), "utf8");
      const m = /<script>window\.__CHAPTER__ = ([\s\S]*?);<\/script>/.exec(html);
      if (!m) throw new Error(`${lang}/${ch.href}: no chapter data`);
      out.push({ lang, path, html, data: JSON.parse(m[1]) as ChapterData });
    }
  }
  return out;
}

test.skipIf(!built)("every built page carries structured data that agrees with the page", () => {
  const problems: string[] = [];
  const pages = builtPages();
  // Both languages hold over a hundred pages; far fewer means the walk
  // looked in the wrong place and proved nothing.
  expect(pages.length).toBeGreaterThan(200);
  for (const p of pages) {
    const at = `${p.lang}/${p.path || "index"}`;
    const other: Lang = p.lang === "en" ? "zh" : "en";
    const lds = jsonLd(p.html);
    if (lds.length !== 1) { problems.push(`${at}: ${lds.length} JSON-LD elements`); continue; }
    const graph: Node[] = lds[0]["@graph"] ?? [lds[0]];
    const node = graph[0];
    const url = pageUrl(p.lang, p.path);
    if (node["@id"] !== url || node.url !== url) problems.push(`${at}: node is ${node["@id"]}`);
    if (node.inLanguage !== LANG_TAG[p.lang]) problems.push(`${at}: inLanguage ${node.inLanguage}`);
    if (node.license !== LICENSE_URL) problems.push(`${at}: license ${node.license}`);
    if (node.author?.name !== AUTHOR || !node.author?.url) problems.push(`${at}: author`);

    // The translation link runs from English to Chinese, and names a page the build wrote.
    const link = p.lang === "en" ? node.workTranslation : node.translationOfWork;
    const wrong = p.lang === "en" ? node.translationOfWork : node.workTranslation;
    if (wrong) problems.push(`${at}: translation link in the wrong direction`);
    if (link) {
      if (link.url !== pageUrl(other, p.path) || link.inLanguage !== LANG_TAG[other]) problems.push(`${at}: translation ${link.url}`);
      else if (!existsSync(builtFile(link.url))) problems.push(`${at}: translation ${link.url} was not built`);
    } else if (existsSync(builtFile(pageUrl(other, p.path)))) {
      problems.push(`${at}: the ${other} page exists but is not linked`);
    }

    if (p.path === "") {
      if (graph.length !== 1 || node["@type"] !== "Book") problems.push(`${at}: home is ${node["@type"]}`);
      if (!node.name || !node.description || !node.publisher?.name || !node.publisher?.url) problems.push(`${at}: book fields`);
      continue;
    }

    if (node["@type"] !== "Chapter") problems.push(`${at}: ${node["@type"]}`);
    if (node.name !== p.data.title) problems.push(`${at}: name ${node.name}`);
    if (node.isPartOf?.["@id"] !== pageUrl(p.lang, "")) problems.push(`${at}: isPartOf ${node.isPartOf?.["@id"]}`);
    if ((node.position ?? "") !== (p.data.chapterNum ? Number(p.data.chapterNum) : "")) problems.push(`${at}: position ${node.position}`);
    if (node.dateModified !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(node.dateModified)) problems.push(`${at}: dateModified ${node.dateModified}`);

    const crumbs = graph.find((n) => n["@type"] === "BreadcrumbList")?.itemListElement ?? [];
    if (crumbs.length < 2 || crumbs[0].item !== pageUrl(p.lang, "") || crumbs.at(-1).name !== node.name) problems.push(`${at}: breadcrumb`);
    for (const c of crumbs.slice(0, -1)) if (!c.item || !existsSync(builtFile(c.item))) problems.push(`${at}: crumb ${c.item} was not built`);
  }
  expect(problems).toEqual([]);
});

test.skipIf(!built)("every built page's head names a twin and a license the build wrote", () => {
  const problems: string[] = [];
  for (const p of builtPages()) {
    const twin = headLink(p.html, 'rel="alternate" type="text/markdown"');
    if (twin !== markdownPath(p.lang, p.path) || !existsSync(join(outRoot, twin))) problems.push(`${p.lang}/${p.path}: twin ${twin}`);
    if (headLink(p.html, 'rel="license"') !== LICENSE_URL) problems.push(`${p.lang}/${p.path}: license`);
  }
  expect(problems).toEqual([]);
});
