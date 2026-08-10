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

test("the English and Chinese manifests contain the same 125 pages", () => {
  const english = manifestPages("en");
  const chinese = manifestPages("zh");
  expect(english).toHaveLength(125);
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

test("Chinese reader prose does not use em dashes", () => {
  const offenders = qmdFiles("zh").filter((page) =>
    readFileSync(join(repoRoot, "zh", page), "utf8").includes("—"),
  );
  expect(offenders).toEqual([]);
});
