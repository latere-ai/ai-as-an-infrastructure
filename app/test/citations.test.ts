// Guards for the refs/-as-single-literature-store invariant, so a future edit
// can't silently lose a work or orphan a citation:
//   1. No literature regression: the merged refs/*.bib must still cover every
//      key the (now-deleted) references.bib held. refs-floor.json is that frozen
//      377-key set, captured at the loader flip; refs/ may grow, never shrink
//      below it. Delete a key from the floor only when intentionally dropping a
//      work (and say why in the commit).
//   2. No orphaned citations: every inline [@key] in any chapter resolves to an
//      entry in the merged bibliography (what the reader's loader does at build).

import { test, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadBibliographyDir } from "../src/pipeline/citations.ts";

const repoRoot = join(import.meta.dir, "..", "..");
const bib = loadBibliographyDir(join(repoRoot, "refs"));
const floor: string[] = JSON.parse(readFileSync(join(import.meta.dir, "refs-floor.json"), "utf8"));

test("refs/ still covers every work the old references.bib held (no literature lost)", () => {
  const missing = floor.filter((k) => !bib.entries.has(k));
  expect(missing).toEqual([]);
});

function qmds(): string[] {
  const out: string[] = [];
  for (const lang of ["en", "zh"]) {
    const root = join(repoRoot, lang);
    for (const part of readdirSync(root)) {
      let entries: string[];
      try { entries = readdirSync(join(root, part)); } catch { continue; }
      for (const f of entries) if (/^\d+-.*\.qmd$/.test(f)) out.push(join(root, part, f));
    }
  }
  return out;
}

function inlineKeys(src: string): string[] {
  const keys = new Set<string>();
  for (const m of src.matchAll(/\[([^\]]*@[^\]]+)\]/g)) {
    for (const km of m[1].matchAll(/@([a-zA-Z][a-zA-Z0-9_:.-]+)/g)) {
      const k = km[1];
      if (!["sec", "fig", "tbl", "eq", "gls"].includes(k) && !/^(sec|fig|tbl|eq|gls)[-:]/.test(k)) keys.add(k);
    }
  }
  return [...keys];
}

test("every inline [@key] resolves in the merged refs/ bibliography", () => {
  const unresolved: string[] = [];
  for (const f of qmds()) {
    for (const k of inlineKeys(readFileSync(f, "utf8"))) {
      if (!bib.entries.has(k)) unresolved.push(`${k} (${f.replace(repoRoot + "/", "")})`);
    }
  }
  expect(unresolved).toEqual([]);
});
