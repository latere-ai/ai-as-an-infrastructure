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

// A key defined in more than one refs/*.bib file must name one work. The
// loader keeps the definition from the file that sorts last, so a key reused
// for a different source silently renders the wrong work in every chapter
// that cites it (nvidia2025nvfp4 once pointed an inference chapter at a
// pretraining paper). Copies may differ in URL (arXiv versus proceedings) and
// in title spelling, but the titles must still name the same work.
const knownKeyCollisions = new Set(["mcp2026rc"]);

function titleWords(title: string): Set<string> {
  return new Set(title.replace(/[{}\\]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean));
}

test("a citation key names the same work in every refs file that defines it", () => {
  const defs = new Map<string, { file: string; url: string; title: string }[]>();
  const refsDir = join(repoRoot, "refs");
  for (const file of readdirSync(refsDir).filter((f) => f.endsWith(".bib") && !f.startsWith("00-")).sort()) {
    const src = readFileSync(join(refsDir, file), "utf8");
    for (const m of src.matchAll(/@\w+\{([^,\s]+),([\s\S]*?)\n\}/g)) {
      const body = m[2];
      const url = body.match(/\burl\s*=\s*\{([^}]*)\}/)?.[1] ?? body.match(/\bdoi\s*=\s*\{([^}]*)\}/)?.[1] ?? "";
      const title = body.match(/\btitle\s*=\s*\{([\s\S]*?)\},\s*\n/)?.[1] ?? "";
      const list = defs.get(m[1]) ?? [];
      list.push({ file, url, title });
      defs.set(m[1], list);
    }
  }
  const conflicts: string[] = [];
  for (const [key, list] of defs) {
    if (list.length < 2 || knownKeyCollisions.has(key)) continue;
    if (new Set(list.map((d) => d.url)).size === 1) continue;
    const [first, ...rest] = list.map((d) => titleWords(d.title));
    const sameWork = rest.every((words) => {
      const shared = [...words].filter((w) => first.has(w)).length;
      return shared / Math.min(words.size, first.size) >= 0.6;
    });
    if (!sameWork) conflicts.push(`${key}: ${list.map((d) => d.file).join(", ")}`);
  }
  expect(conflicts).toEqual([]);
});
