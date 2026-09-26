// What the book publishes for agents and tools that read text: a Markdown twin
// of every page in both languages, and the agentweb.json page index that lists
// them. Every page of both manifests is compiled with the whole-book context
// the build uses, and each twin is checked for structure: YAML front matter
// naming the page, no markup or relative link left in the body, every KaTeX
// formula back as TeX, every figure as a link to the live page. The index is
// checked against the contract the server's agentweb package decodes. When a
// build is present, the files on disk are checked too. None of the checks
// depends on wording.

import { expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { loadBook } from "./pipeline/book.ts";
import { loadBibliographyDir } from "./pipeline/citations.ts";
import { compileChapter } from "./pipeline/compile.ts";
import { buildCrossref } from "./pipeline/crossref.ts";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { loadGlossary } from "./pipeline/glossary.ts";
import { agentwebIndex, agentwebPage, type AgentwebIndex } from "./agentweb.ts";
import { BASE, LICENSE, LICENSE_URL, SITE_NAME, pageUrl } from "./site.ts";
import { markdownTwin, twinInput, type TwinInput } from "./twin.ts";
import type { Lang } from "./types.ts";

const repoRoot = join(import.meta.dir, "../..");
const outRoot = join(repoRoot, "_book");
const langs: Lang[] = ["en", "zh"];
const books = { en: loadBook("en", repoRoot), zh: loadBook("zh", repoRoot) };
const hrefs = { en: new Set(books.en.chapters.map((c) => c.href)), zh: new Set(books.zh.chapters.map((c) => c.href)) };
const graphviz = await loadGraphviz();
const glossary = loadGlossary(join(repoRoot, "glossary.yml"));

interface Page {
  lang: Lang;
  href: string;
  path: string; // clean path, "" for the home page
  html: string; // the compiled article body
  input: TwinInput;
  twin: string;
}

// Converter warnings name an element it has no rule for.
const converterWarnings: string[] = [];

function compileBook(lang: Lang): Page[] {
  const book = books[lang];
  const other: Lang = lang === "en" ? "zh" : "en";
  const ctx = {
    bib: loadBibliographyDir(join(repoRoot, "refs")),
    xref: buildCrossref(book),
    graphviz,
    refsDir: join(repoRoot, "refs"),
    glossary,
    glossaryUsed: new Set<string>(),
    glossaryFirstUses: new Map(),
  };
  return book.chapters.map((ch) => {
    const data = compileChapter(book, ch, ctx);
    const input = twinInput(book, ch, data, hrefs[other]);
    const warn = console.warn;
    console.warn = (...args: unknown[]) => { converterWarnings.push(args.join(" ")); };
    try {
      return { lang, href: ch.href, path: data.path, html: data.contentHtml, input, twin: markdownTwin(input) };
    } finally {
      console.warn = warn;
    }
  });
}

const pages = [...compileBook("en"), ...compileBook("zh")];
const built = existsSync(join(outRoot, "en", "index.md"));

function split(twin: string): { meta: Record<string, any>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(twin);
  if (!m) throw new Error("twin has no front matter");
  return { meta: parseYaml(m[1]), body: m[2] };
}

// The body without fenced code blocks and inline code spans: code may show
// markup or link syntax as its content.
function prose(body: string): string {
  return body.replace(/^(`{3,})[^\n]*\n[\s\S]*?\n\1$/gm, "").replace(/(`+)[^`\n][\s\S]*?\1/g, "");
}

test("every page of both manifests has a twin", () => {
  for (const lang of langs) {
    const own = pages.filter((p) => p.lang === lang);
    expect(own.map((p) => p.href)).toEqual(books[lang].chapters.map((c) => c.href));
    for (const p of own) expect(p.twin.startsWith("---\n")).toBe(true);
  }
});

test("the converter has a rule for every element the book renders", () => {
  expect(converterWarnings).toEqual([]);
});

test("front matter parses and names the page's address, language and license", () => {
  for (const p of pages) {
    const { meta, body } = split(p.twin);
    expect(typeof meta.title).toBe("string");
    expect(meta.title.length).toBeGreaterThan(0);
    expect(meta.lang).toBe(p.lang);
    expect(meta.url).toBe(pageUrl(p.lang, p.path));
    expect(meta.license).toBe(LICENSE);
    expect(meta.license_url).toBe(LICENSE_URL);
    for (const other of p.input.alternates) expect(meta.alternate?.[other]).toBe(pageUrl(other, p.path));
    if (p.input.lastmod) expect(String(meta.updated)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(body.trimStart().startsWith("# ")).toBe(true);
  }
});

test("no twin carries markup or a relative link", () => {
  const offenders: string[] = [];
  for (const p of pages) {
    const text = prose(split(p.twin).body);
    for (const bad of ["<svg", "<script", 'class="']) if (text.includes(bad)) offenders.push(`${p.lang}/${p.href}: ${bad}`);
    // "](" not escaped as "\](" opens a link destination, which must be absolute.
    for (const m of text.matchAll(/(?<!\\)\]\(([^)\s]*)/g)) {
      if (!/^(https?:\/\/|#|mailto:)/.test(m[1])) offenders.push(`${p.lang}/${p.href}: ](${m[1]}`);
    }
  }
  expect(offenders).toEqual([]);
});

// Math spans in a Markdown body: $$ display blocks on their own lines, then
// inline $...$ (and $$...$$ inside a line). An escaped \$ is prose. Quote
// markers and list indentation are removed first, so a formula inside a
// callout or a list item counts too.
function mathSpans(body: string): number {
  let text = prose(body.split("\n").map((l) => l.replace(/^(?:>|[ \t])+/, "")).join("\n"));
  const display = text.match(/^\$\$\n[\s\S]*?\n\$\$$/gm) ?? [];
  text = text.replace(/^\$\$\n[\s\S]*?\n\$\$$/gm, "");
  const inlineDisplay = text.match(/(?<!\\)\$\$[^$\n]+?\$\$/g) ?? [];
  text = text.replace(/(?<!\\)\$\$[^$\n]+?\$\$/g, "");
  const inline = text.match(/(?<![\\$])\$(?:\\.|[^$\\\n])+?\$/g) ?? [];
  return display.length + inlineDisplay.length + inline.length;
}

test("every formula survives as TeX", () => {
  const lost: string[] = [];
  for (const p of pages) {
    const formulas = p.html.split('<annotation encoding="application/x-tex">').length - 1;
    const spans = mathSpans(split(p.twin).body);
    if (spans !== formulas) lost.push(`${p.lang}/${p.href}: ${formulas} formulas, ${spans} TeX spans`);
  }
  expect(lost).toEqual([]);
  for (const lang of langs) {
    const math = pages.find((p) => p.lang === lang && p.href === "foundations/scaling-laws")!;
    const body = split(math.twin).body;
    expect(body).toMatch(/^\$\$\n[\s\S]+?\n\$\$$/m);
    expect(body).toMatch(/(?<![\\$])\$[^$\n]*\\[a-zA-Z]+[^$\n]*\$/);
  }
});

test("every figure survives as its caption linked to the figure on the live page", () => {
  const missing: string[] = [];
  for (const p of pages) {
    const lines = split(p.twin).body.split("\n").map((l) => l.replace(/^(> ?)+/, ""));
    for (const m of p.html.matchAll(/<figure\b[^>]*\bid="([^"]+)"/g)) {
      const target = `](${pageUrl(p.lang, p.path)}#${m[1]})`;
      if (!lines.some((l) => l.startsWith("[") && l.endsWith(target))) missing.push(`${p.lang}/${p.href}#${m[1]}`);
    }
  }
  expect(missing).toEqual([]);
  expect(pages.some((p) => p.html.includes("<figure"))).toBe(true);
});

test.skipIf(!built)("the build writes every twin beside its page, precompressed when large", () => {
  for (const lang of langs) {
    for (const ch of books[lang].chapters) expect(existsSync(join(outRoot, lang, `${ch.href}.md`))).toBe(true);
    expect(existsSync(join(outRoot, lang, "foundations", "scaling-laws.md.gz"))).toBe(true);
  }
});

// Problems with a page index against the agentweb.json contract. `markdownExists`
// says whether a twin path resolves to a file.
function contractProblems(index: AgentwebIndex, markdownExists: (path: string) => boolean): string[] {
  const problems: string[] = [];
  const keys = (o: object) => Object.keys(o).sort().join(",");
  if (keys(index) !== "origin,pages,summary,title") problems.push(`top-level fields: ${keys(index)}`);
  if (index.origin !== BASE) problems.push(`origin ${index.origin}`);
  if (index.title !== SITE_NAME) problems.push(`title ${index.title}`);
  if (typeof index.summary !== "string" || !index.summary.trim()) problems.push("summary is empty");
  const allowed = new Set(["path", "lang", "title", "description", "section", "lastmod", "markdown", "alternates"]);
  const paths = new Set(index.pages.map((p) => p.path));
  let seenZh = false;
  for (const p of index.pages) {
    const at = `${p.path}:`;
    for (const k of Object.keys(p)) if (!allowed.has(k)) problems.push(`${at} unknown field ${k}`);
    for (const [k, v] of Object.entries(p)) {
      const empty = v === "" || v === null || v === undefined || (typeof v === "object" && !Object.keys(v).length);
      if (empty) problems.push(`${at} empty ${k}`);
    }
    if (p.lang !== "en" && p.lang !== "zh") { problems.push(`${at} lang ${p.lang}`); continue; }
    if (p.lang === "zh") seenZh = true;
    else if (seenZh) problems.push(`${at} English page after a Chinese one`);
    if (typeof p.title !== "string" || !p.title.trim()) problems.push(`${at} no title`);
    if (!p.path.startsWith(`/${p.lang}/`)) problems.push(`${at} path is not under /${p.lang}/`);
    if (!p.markdown?.startsWith(`/${p.lang}/`) || !p.markdown.endsWith(".md")) problems.push(`${at} markdown ${p.markdown}`);
    else if (!markdownExists(p.markdown)) problems.push(`${at} markdown ${p.markdown} does not exist`);
    if (p.lastmod !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(p.lastmod)) problems.push(`${at} lastmod ${p.lastmod}`);
    for (const [lang, alt] of Object.entries(p.alternates ?? {})) {
      if (lang === p.lang || !alt.startsWith(`/${lang}/`)) problems.push(`${at} alternate ${lang} ${alt}`);
      else if (!paths.has(alt)) problems.push(`${at} alternate ${alt} is not a listed page`);
    }
  }
  for (const lang of langs) {
    const listed = index.pages.filter((p) => p.lang === lang).map((p) => p.path);
    const manifest = books[lang].chapters.map((c) => pageUrl(lang, c.href === "index" ? "" : c.href).slice(BASE.length));
    if (listed.join("\n") !== manifest.join("\n")) problems.push(`${lang}: pages differ from the manifest's reading order (${listed.length} listed, ${manifest.length} in the manifest)`);
  }
  return problems;
}

const twinPaths = new Set(pages.map((p) => `/${p.lang}/${p.href}.md`));

test("the page index follows the agentweb.json contract", () => {
  const index = agentwebIndex(pages.map((p) => agentwebPage(p.input)));
  expect(contractProblems(index, (path) => twinPaths.has(path))).toEqual([]);
  const home = index.pages.find((p) => p.lang === "en" && p.path === "/en/")!;
  expect(home.markdown).toBe("/en/index.md");
  expect(index.pages.filter((p) => p.lang === "en").length).toBe(books.en.chapters.length);
  expect(index.pages.filter((p) => p.lang === "zh").length).toBe(books.zh.chapters.length);
});

const builtIndex = join(outRoot, "agentweb.json");
test.skipIf(!existsSync(builtIndex))("the built agentweb.json follows the contract and names twins on disk", () => {
  const index = JSON.parse(readFileSync(builtIndex, "utf8")) as AgentwebIndex;
  expect(contractProblems(index, (path) => existsSync(join(outRoot, path)))).toEqual([]);
});
