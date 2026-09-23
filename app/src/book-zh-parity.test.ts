import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import YAML from "yaml";
import { loadBibliographyDir } from "./pipeline/citations.ts";

const repoRoot = join(import.meta.dir, "../..");
const bibliography = loadBibliographyDir(join(repoRoot, "refs"));

function manifestPages(lang: "en" | "zh"): string[] {
  const source = readFileSync(join(repoRoot, lang, "book.yml"), "utf8");
  const manifest = YAML.parse(source) as {
    book: { chapters: Array<string | { intro?: string; chapters?: string[] }> };
  };
  const pages: string[] = [];
  for (const item of manifest.book.chapters) {
    if (typeof item === "string") pages.push(item);
    else {
      if (item.intro) pages.push(item.intro);
      pages.push(...(item.chapters ?? []));
    }
  }
  return pages;
}

function qmdFiles(lang: "en" | "zh"): string[] {
  const root = join(repoRoot, lang);
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) walk(path);
      else if (entry.name.endsWith(".qmd")) files.push(relative(root, path));
    }
  };
  walk(root);
  return files.sort();
}

function matches(source: string, pattern: RegExp): string[] {
  return [...source.matchAll(pattern)].map((match) => match[1]);
}

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort();
}

function signature(source: string) {
  const fenceKinds = [...source.matchAll(/^```(?:\{([^}\s]+)|([^\s{]*))/gm)]
    .map((match) => match[1] ?? match[2])
    .filter((kind) => kind && kind !== "text");
  return {
    headingLevels: matches(source, /^(#{1,4})\s+/gm).map((marks) => marks.length),
    ids: matches(source, /\{#([\w:-]+)/g),
    citations: uniqueSorted(matches(source, /@([\w:-]+)/g).filter((key) => bibliography.entries.has(key))),
    crossrefs: uniqueSorted(matches(source, /@(sec-[\w-]+)/g)),
    glossary: uniqueSorted(matches(source, /@(gls-[\w-]+)/g)),
    fenceKinds,
    tableRows: source.match(/^\|.*\|$/gm)?.length ?? 0,
  };
}

function displayMath(source: string): string[] {
  return matches(source, /^\$\$\n([\s\S]*?)\n\$\$$/gm);
}

// Display math is shared between the trees. Prose inside \text{...} is
// translated, and alignment markup, explicit spacing, and whitespace are
// layout, so those are masked before the formulas are compared.
function canonicalMath(block: string): string {
  return block
    .replace(/\\text\{[^{}]*\}/g, "\\text{}")
    .replace(/\\(?:begin|end)\{(?:aligned|gathered)\}/g, "")
    .replace(/\\\\/g, "")
    .replace(/\\quad|\\qquad|&|\{\}/g, "")
    .replace(/\s+/g, "");
}

// Pages whose Chinese display math currently differs from the English after
// canonicalization: trailing punctuation, an added \times, sized delimiters,
// a two-line \substack label, or equations restated with intermediate
// variables. The list is exact, so a new divergence and a reconciled page
// both fail until it is updated.
const knownMathDivergence = [
  "foundations/03-tokenization.qmd",
  "foundations/04-transformer-architecture.qmd",
  "foundations/05-moe-ssm-hybrids.qmd",
  "generative/01-diffusion-flow-matching.qmd",
  "generative/03-speech-and-voice.qmd",
  "frontiers/03-verification-frontier.qmd",
  "ecosystem/05-market-structure.qmd",
  "practice/07-evaluation-and-observability.qmd",
];

// An interactive figure is identified by its data-viz name. Its numeric and
// boolean data-* attributes are the model inputs, and data-family, data-mode,
// and data-pattern select the model; all must match across trees. Label
// attributes are translated and are not compared.
function vizSignature(source: string): string[] {
  return [...source.matchAll(/<[a-z]+\b[^>]*\bdata-viz="[^"]+"[^>]*>/g)].map(([tag]) => {
    const name = tag.match(/\bdata-viz="([^"]+)"/)![1];
    const inputs = [
      ...tag.matchAll(/\b(data-[\w-]+)="(-?[\d.]+(?:e-?\d+)?|true|false)"/g),
      ...tag.matchAll(/\b(data-(?:family|mode|pattern))="([^"]*)"/g),
    ]
      .map(([, key, value]) => `${key}=${value}`)
      .sort();
    return [name, ...inputs].join(" ");
  });
}

test("the English and Chinese manifests contain the same 126 pages", () => {
  const english = manifestPages("en");
  const chinese = manifestPages("zh");
  expect(english).toHaveLength(126);
  expect(chinese).toEqual(english);
  expect(qmdFiles("en")).toEqual([...english].sort());
  expect(qmdFiles("zh")).toEqual([...chinese].sort());
});

test("every Chinese page preserves the English structural and evidence contract", () => {
  for (const page of manifestPages("en")) {
    const english = signature(readFileSync(join(repoRoot, "en", page), "utf8"));
    const chinese = signature(readFileSync(join(repoRoot, "zh", page), "utf8"));

    expect(chinese.headingLevels, `${page}: heading topology`).toEqual(english.headingLevels);
    expect(chinese.ids, `${page}: anchors and artifact identifiers`).toEqual(english.ids);
    expect(chinese.citations, `${page}: cited evidence`).toEqual(english.citations);
    expect(chinese.crossrefs, `${page}: internal cross-references`).toEqual(english.crossrefs);
    expect(chinese.fenceKinds, `${page}: executable and diagram blocks`).toEqual(english.fenceKinds);
    expect(chinese.tableRows, `${page}: table structure`).toBe(english.tableRows);

    for (const term of english.glossary) {
      expect(chinese.glossary, `${page}: glossary term ${term}`).toContain(term);
    }
  }
});

test("every Chinese page carries the English display math", () => {
  const divergent: string[] = [];
  for (const page of manifestPages("en")) {
    const english = displayMath(readFileSync(join(repoRoot, "en", page), "utf8")).map(canonicalMath);
    const chinese = displayMath(readFileSync(join(repoRoot, "zh", page), "utf8")).map(canonicalMath);
    expect(chinese.length, `${page}: display math block count`).toBe(english.length);
    if (knownMathDivergence.includes(page)) {
      if (chinese.some((block, i) => block !== english[i])) divergent.push(page);
      continue;
    }
    expect(chinese, `${page}: display math`).toEqual(english);
  }
  expect(divergent.sort(), "known divergence list is out of date").toEqual([...knownMathDivergence].sort());
});

test("every Chinese page carries the English interactive figures and their inputs", () => {
  for (const page of manifestPages("en")) {
    const english = readFileSync(join(repoRoot, "en", page), "utf8");
    const chinese = readFileSync(join(repoRoot, "zh", page), "utf8");
    expect(vizSignature(chinese), `${page}: data-viz figures`).toEqual(vizSignature(english));
    expect(matches(chinese, /\b(data-chip)=/g).length, `${page}: stepper steps`).toBe(
      matches(english, /\b(data-chip)=/g).length,
    );
  }
});

test("interactive figures declare the language of the page they are on", () => {
  for (const lang of ["en", "zh"] as const) {
    for (const page of manifestPages(lang)) {
      const declared = matches(readFileSync(join(repoRoot, lang, page), "utf8"), /\bdata-lang="([^"]*)"/g);
      expect(declared.filter((value) => value !== lang), `${lang}/${page}: data-lang`).toEqual([]);
    }
  }
});

test("Chinese reader prose does not use em dashes", () => {
  const offenders = qmdFiles("zh").filter((page) =>
    readFileSync(join(repoRoot, "zh", page), "utf8").includes("—"),
  );
  expect(offenders).toEqual([]);
});
