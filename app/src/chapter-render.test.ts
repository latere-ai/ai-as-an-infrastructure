// Book-wide rendering checks. Every page of both manifests goes through the
// reader's markdown pipeline with the whole-book context the build uses
// (bibliography, cross-reference map, glossary). The checks are mechanical:
// diagrams parse and fit the reading column, no markdown syntax leaks into the
// page, no reference goes unresolved, content after a block is not swallowed,
// display math can wrap to the column, and hard wraps do not split hyphenated
// compounds. None depends on wording.

import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { loadBook } from "./pipeline/book.ts";
import { loadBibliographyDir } from "./pipeline/citations.ts";
import { stripCjkSoftBreaks } from "./pipeline/cjk.ts";
import { buildCrossref } from "./pipeline/crossref.ts";
import { LAYOUT_FONT } from "./pipeline/diagram-source.ts";
import { loadGraphviz, PHONE_COLUMN_PX, renderDot } from "./pipeline/diagrams.ts";
import { loadGlossary } from "./pipeline/glossary.ts";
import { renderMarkdown } from "./pipeline/markdown.ts";
import type { Lang } from "./types.ts";

const repoRoot = join(import.meta.dir, "../..");
const graphviz = await loadGraphviz();
const glossary = loadGlossary(join(repoRoot, "glossary.yml"));

interface Page {
  lang: Lang;
  href: string;
  path: string; // repo-relative source path
  source: string;
  html: string;
}

function renderBook(lang: Lang): Page[] {
  const book = loadBook(lang, repoRoot);
  const bib = loadBibliographyDir(join(repoRoot, "refs"));
  const xref = buildCrossref(book);
  const glossaryUsed = new Set<string>();
  const glossaryFirstUses = new Map();
  return book.chapters.map((ch) => {
    const source = readFileSync(ch.qmdPath, "utf8");
    const { html } = renderMarkdown(lang === "zh" ? stripCjkSoftBreaks(source) : source, {
      bib,
      xref,
      currentHref: ch.href,
      chapterTitle: ch.title,
      chapterNum: ch.num,
      prefix: "../".repeat(ch.href.split("/").length - 1),
      graphviz,
      lang,
      glossary,
      glossarySeen: new Set(),
      glossaryUsed,
      glossaryFirstUses,
    });
    return { lang, href: ch.href, path: ch.srcRel, source, html };
  });
}

const pages = [...renderBook("en"), ...renderBook("zh")];

// Source lines classified the way an author reads them: fenced code (including
// diagram and raw HTML fences), display math between `$$` lines, fenced-div
// markers, and everything else as prose.
type LineKind = "fence" | "code" | "math-delim" | "math" | "div" | "prose";

interface Classified {
  lines: string[];
  kinds: LineKind[];
  openFence: boolean;
  openMath: boolean;
  divDepth: number; // open minus closed fenced divs at the end of the page
  orphanDivClose: boolean; // a closing ::: with no open div
}

function classify(source: string): Classified {
  const lines = source.split("\n");
  const kinds: LineKind[] = [];
  let fence = "";
  let math = false;
  let divDepth = 0;
  let orphanDivClose = false;
  for (const line of lines) {
    const marker = line.match(/^(`{3,}|~{3,})/)?.[1];
    if (fence) {
      const closes = marker && marker[0] === fence[0] && marker.length >= fence.length && line.trim() === marker;
      kinds.push(closes ? "fence" : "code");
      if (closes) fence = "";
    } else if (marker) {
      kinds.push("fence");
      fence = marker;
    } else if (/^\$\$\s*$/.test(line)) {
      kinds.push("math-delim");
      math = !math;
    } else if (math) {
      kinds.push("math");
    } else if (/^:{3,}/.test(line)) {
      kinds.push("div");
      if (/^:{3,}\s*$/.test(line)) {
        if (divDepth === 0) orphanDivClose = true;
        else divDepth--;
      } else {
        divDepth++;
      }
    } else {
      kinds.push("prose");
    }
  }
  return { lines, kinds, openFence: fence !== "", openMath: math, divDepth, orphanDivClose };
}

function dotBodies(source: string): string[] {
  return [...source.matchAll(/^```\{dot\}[ \t]*\n([\s\S]*?)\n```[ \t]*$/gm)].map(
    (match) => match[1],
  );
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&");
}

// The text a reader sees as prose: code, scripts, styles, diagram SVG, and the
// TeX source KaTeX keeps in its MathML annotation are removed first.
function visibleText(html: string): string {
  const stripped = html
    .replace(/<pre[\s\S]*?<\/pre>/g, " ")
    .replace(/<code[\s\S]*?<\/code>/g, " ")
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<svg[\s\S]*?<\/svg>/g, " ")
    .replace(/<annotation[\s\S]*?<\/annotation>/g, " ")
    .replace(/<[^>]+>/g, " ");
  return decodeEntities(stripped).replace(/\s+/g, " ");
}

// Inline code and inline math can wrap across source lines, so the span state
// is carried from line to line within a paragraph.
interface SpanState {
  code: boolean;
  math: boolean;
}

// Replace every character inside an inline code or math span (and the
// delimiters) with NUL, returning the masked line and the state after it.
function maskSpans(line: string, start: SpanState): { masked: string; end: SpanState } {
  let { code, math } = start;
  let masked = "";
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (code) {
      if (ch === "`") code = false;
      masked += "\0";
    } else if (ch === "\\" && (line[i + 1] === "$" || line[i + 1] === "`")) {
      masked += "\0\0";
      i++;
    } else if (ch === "`") {
      code = true;
      masked += "\0";
    } else if (ch === "$") {
      math = !math;
      masked += "\0";
    } else {
      masked += math ? "\0" : ch;
    }
  }
  return { masked, end: { code, math } };
}

// The masked form of every prose line; non-prose and blank lines end a
// paragraph and reset the span state.
function maskedProse(lines: string[], kinds: LineKind[]): (string | null)[] {
  let state: SpanState = { code: false, math: false };
  return lines.map((line, i) => {
    if (kinds[i] !== "prose" || line.trim() === "") {
      state = { code: false, math: false };
      return null;
    }
    const { masked, end } = maskSpans(line, state);
    state = end;
    return masked;
  });
}

// The longest run of a masked prose line that renders as literal text: markup,
// link targets, and @-references are cut out, since the reader replaces them
// with generated text.
function sampleOf(masked: string | null, lang: Lang): string | null {
  if (masked === null || /^\s*(#\s|\||<|\/\/\||%%\|)/.test(masked)) return null;
  const cut = masked
    .replace(/^\s*#{2,6}\s+/, "")
    .replace(/\s*\{[^}]*\}\s*$/, "")
    .replace(/^\s*(?:[-*+]|\d+\.)\s+/, "")
    .replace(/^\s*>\s?/, "")
    .replace(/\]\([^)]*\)/g, "\0")
    .replace(/(?<![A-Za-z0-9])@[\w:.-]+/g, "\0")
    .replace(/<[^>]*>/g, "\0");
  const safe = lang === "en" ? /[A-Za-z0-9 ,.;:'?!%-]+/g : /[\u3400-\u9fffA-Za-z0-9 ，。：；？！、「」（）,.%-]+/g;
  const runs = (cut.match(safe) ?? []).map((run) => run.trim().replace(/\s+/g, " "));
  const best = runs.reduce((a, b) => (b.length > a.length ? b : a), "");
  return best.length >= (lang === "en" ? 20 : 8) ? best : null;
}

// Graphviz figures that still scroll horizontally in the phone column: even
// their narrowest layout, scaled until its smallest text is 11 px, is wider
// than the column. The list is exact: a figure that newly exceeds the column,
// and a listed figure that now fits, both fail until the list is updated.
const knownWideFigures: string[] = [
];

// Hard-wrapped hyphenated compounds already in the sources, as
// "<path>: <compound>". Exact for the same reason as the figure list.
const knownSplitCompounds: string[] = [];

// Pages where a `**` run does not close and reaches the reader as literal
// asterisks. Bold next to CJK text, such as a label ending in full-width
// punctuation directly followed by CJK text (`**标签：**正文`), is handled by
// cjkEmphasis in pipeline/cjk.ts, so a page listed here leaks for another
// reason. Exact list, as above.
const knownBoldLeaks: string[] = [];

test("every Graphviz figure parses and fits the mobile reading column", () => {
  const failures: string[] = [];
  const wide: string[] = [];
  for (const page of pages) {
    dotBodies(page.source).forEach((body, index) => {
      const label = body.match(/^\s*\/\/\|\s*label:\s*(\S+)/m)?.[1] ?? `${page.href}#${index}`;
      const html = renderDot(graphviz, body, new Map(), page.href, "");
      if (html.includes("graphviz error")) {
        failures.push(`${page.path}: ${label} does not parse`);
        return;
      }
      const minWidths = [...html.matchAll(/<svg[^>]*style="max-width:[\d.]+px;min-width:([\d.]+)px"/g)].map((m) => Number(m[1]));
      if (!minWidths.length) failures.push(`${page.path}: ${label} has no width bounds`);
      else if (Math.min(...minWidths) > PHONE_COLUMN_PX) wide.push(`${page.lang}:${label}`);
    });
  }
  expect(failures).toEqual([]);
  expect(wide.sort(), "figures wider than the mobile reading column").toEqual([...knownWideFigures].sort());
});

test("every Graphviz figure is laid out in the layout font and colored by theme class", () => {
  // Layout and page must measure text with the same metrics, and every color
  // must follow the theme, whatever the source wrote.
  const failures: string[] = [];
  for (const page of pages) {
    dotBodies(page.source).forEach((body, index) => {
      const label = body.match(/^\s*\/\/\|\s*label:\s*(\S+)/m)?.[1] ?? `${page.href}#${index}`;
      const html = renderDot(graphviz, body, new Map(), page.href, "");
      for (const m of html.matchAll(/<text\b[^>]*>/g)) {
        if (!m[0].includes(`font-family="${LAYOUT_FONT}`)) failures.push(`${page.path}: ${label} text not in ${LAYOUT_FONT}`);
        if (!/class="[^"]*dg-f-/.test(m[0])) failures.push(`${page.path}: ${label} text without a color class`);
      }
      for (const m of html.matchAll(/<(?:polygon|polyline|path|ellipse)\b[^>]*>/g)) {
        for (const [, prop, value] of m[0].matchAll(/\s(fill|stroke)="([^"]*)"/g)) {
          if (value === "none" || value === "transparent") continue;
          if (!new RegExp(`class="[^"]*dg-${prop[0]}-`).test(m[0])) failures.push(`${page.path}: ${label} ${prop}="${value}" without a class`);
        }
      }
    });
  }
  expect([...new Set(failures)]).toEqual([]);
});

test("every page compiles without leaking markdown syntax or unresolved references", () => {
  const failures: string[] = [];
  const boldLeaks: string[] = [];
  for (const page of pages) {
    const report = (problem: string) => failures.push(`${page.path}: ${problem}`);
    const { lines, kinds, openFence, openMath, divDepth, orphanDivClose } = classify(page.source);
    // Markdown treats \( and \[ as escaped punctuation, so LaTeX written with
    // those delimiters reaches the reader as plain parentheses and brackets.
    maskedProse(lines, kinds).forEach((line, i) => {
      if (line && /\\[()[\]]/.test(line)) report(`line ${i + 1}: \\( or \\[ math delimiter in prose`);
    });
    if (openFence) report("unclosed code fence");
    if (openMath) report("unclosed $$ block");
    if (divDepth > 0) report("unclosed ::: div");
    if (orphanDivClose) report("::: close without an open div");
    if (/[\0\uFFFD]/.test(page.source)) report("NUL or replacement character in source");

    if (page.html.includes("katex-error")) report("KaTeX error");
    if (page.html.includes("graphviz error")) report("Graphviz error");
    if (/\brdr(?:dot|html)\b/.test(page.html)) report("diagram fence left unrendered");
    for (const match of page.html.matchAll(/class="rdr-(?:cite|xref|gls) [^"]*-missing">([^<]*)</g)) {
      report(`unresolved reference ${match[1]}`);
    }

    const text = visibleText(page.html);
    for (const [name, pattern] of [
      [":::", /:::/],
      ["```", /```/],
      ["$$", /\$\$/],
      ["\\(", /\\\(/],
    ] as const) {
      const at = text.search(pattern);
      if (at >= 0) report(`raw ${name} in prose: "${text.slice(Math.max(0, at - 40), at + 40)}"`);
    }
    if (text.includes("**")) boldLeaks.push(page.path);
  }
  expect(failures).toEqual([]);
  expect(boldLeaks.sort(), "pages showing unrendered ** markers").toEqual([...knownBoldLeaks].sort());
});

test("content after every diagram, code, math, and div block reaches the page", () => {
  const failures: string[] = [];
  for (const page of pages) {
    const report = (problem: string) => failures.push(`${page.path}: ${problem}`);

    const dot = dotBodies(page.source).length;
    const renderedDot = page.html.match(/<div class="rdr-diagram">/g)?.length ?? 0;
    if (renderedDot !== dot) report(`${dot} Graphviz fences, ${renderedDot} rendered`);

    // One sample from the first prose line after each closing block marker,
    // and one from the last prose line of the page, in document order.
    const { lines, kinds } = classify(page.source);
    const masked = maskedProse(lines, kinds);
    const samples: string[] = [];
    const sampleFrom = (start: number) => {
      for (let i = start; i < lines.length && i < start + 8; i++) {
        if (kinds[i] !== "prose") return;
        const sample = sampleOf(masked[i], page.lang);
        if (sample) return samples.push(sample);
      }
    };
    let insideFence = false;
    let insideMath = false;
    kinds.forEach((kind, i) => {
      if (kind === "fence") {
        insideFence = !insideFence;
        if (!insideFence) sampleFrom(i + 1);
      } else if (kind === "math-delim") {
        insideMath = !insideMath;
        if (!insideMath) sampleFrom(i + 1);
      } else if (kind === "div") {
        sampleFrom(i + 1);
      }
    });
    for (let i = lines.length - 1; i >= 0; i--) {
      const sample = sampleOf(masked[i], page.lang);
      if (sample) {
        samples.push(sample);
        break;
      }
    }

    const text = visibleText(page.html);
    let cursor = 0;
    for (const sample of samples) {
      const at = text.indexOf(sample, cursor);
      if (at < 0) {
        report(`missing or out of order after a block: "${sample}"`);
        continue;
      }
      cursor = at;
    }
  }
  expect(failures).toEqual([]);
});

test("hard wraps in prose do not split hyphenated compounds", () => {
  const splits: string[] = [];
  for (const page of pages) {
    const { lines, kinds } = classify(page.source);
    for (let i = 0; i + 1 < lines.length; i++) {
      if (kinds[i] !== "prose" || kinds[i + 1] !== "prose") continue;
      const head = lines[i].match(/([A-Za-z]+)-$/)?.[1];
      const tail = lines[i + 1].match(/^([A-Za-z]+)/)?.[1];
      if (head && tail) splits.push(`${page.path}: ${head}-${tail}`);
    }
  }
  expect(splits.sort(), "hyphenated compounds split across a hard wrap").toEqual([...knownSplitCompounds].sort());
});

// A display formula wider than the column must stay visible. KaTeX emits each
// display as a .katex-html run of inline-block .base spans, split where TeX
// allows a break, and its own stylesheet forbids wrapping; theme.css lifts
// that so the runs wrap, and keeps horizontal scroll for a run that cannot
// break. Both halves are checked: the rule exists, and every rendered display
// has the structure the rule selects.
test("display math wraps at KaTeX break points and scrolls when it cannot", () => {
  const css = readFileSync(join(import.meta.dir, "theme.css"), "utf8");
  expect(css).toMatch(/\.rdr-article \.katex-display > \.katex \{[^}]*white-space: normal/);
  expect(css).toMatch(/\.rdr-article \.katex-display \{[^}]*overflow-x: auto/);

  const unselected: string[] = [];
  let displays = 0;
  for (const page of pages) {
    for (const [, body] of page.html.matchAll(/<span class="katex-display">([\s\S]*?)<\/p>/g)) {
      displays++;
      if (!body.startsWith('<span class="katex">') || !body.includes('<span class="katex-html" aria-hidden="true"><span class="base">'))
        unselected.push(page.path);
    }
  }
  expect(displays).toBeGreaterThan(0);
  expect([...new Set(unselected)], "display math outside the wrap rule's selector").toEqual([]);
});
