import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";
import type { SearchDoc } from "./search-match.ts";
import { RECENT_MAX, SUGGESTED, emptyStateDocs, pushRecent, readRecent } from "./search-suggest.ts";

const root = new URL("../..", import.meta.url).pathname;

function chapters(lang: "en" | "zh"): string {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) walk(join(dir, e.name));
      else if (e.name.endsWith(".qmd")) out.push(readFileSync(join(dir, e.name), "utf8"));
    }
  };
  walk(join(root, lang));
  return out.join("\n").toLowerCase();
}

test("every suggested topic occurs in its own language's chapters", () => {
  for (const lang of ["en", "zh"] as const) {
    const text = chapters(lang);
    for (const term of SUGGESTED[lang]) expect(text.includes(term.toLowerCase())).toBe(true);
  }
  expect(SUGGESTED.en.length).toBe(SUGGESTED.zh.length);
});

const page = (href: string, title = href): SearchDoc => ({ href, anchor: "", num: "", title, heading: "", text: "" });
const docs: SearchDoc[] = [
  page("index", "Preface"), page("orientation/field-map"), page("field/2026-08"), page("field/2026-09"),
  page("glossary"), page("inference/memory-scheduling"), { ...page("inference/memory-scheduling"), anchor: "sec-x", heading: "A section" },
];

test("an empty dialog lists recent pages, skipping the open page and hrefs the index lost", () => {
  const r = emptyStateDocs(docs, ["glossary", "inference/memory-scheduling", "renamed/chapter"], "glossary");
  expect(r.kind).toBe("recent");
  expect(r.docs.map((d) => d.href)).toEqual(["inference/memory-scheduling"]);
  expect(r.docs[0].anchor).toBe("");
});

test("with no history the dialog offers starting pages, with the newest State of the Field", () => {
  const r = emptyStateDocs(docs, [], "inference/memory-scheduling");
  expect(r.kind).toBe("start");
  expect(r.docs.map((d) => d.href)).toEqual(["index", "orientation/field-map", "field/2026-09", "glossary"]);
});

test("recent pages are most recent first, unique, and capped", () => {
  const store = new Map<string, string>();
  const ls = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) };
  const prev = (globalThis as { localStorage?: unknown }).localStorage;
  (globalThis as { localStorage?: unknown }).localStorage = ls;
  try {
    for (const h of ["a", "b", "c", "a", "d", "e", "f"]) pushRecent("en", h);
    expect(readRecent("en")).toEqual(["f", "e", "d", "a", "c"].slice(0, RECENT_MAX));
    expect(readRecent("zh")).toEqual([]);
    store.set("aaai-recent-en", "not json");
    expect(readRecent("en")).toEqual([]);
  } finally {
    (globalThis as { localStorage?: unknown }).localStorage = prev;
  }
});
