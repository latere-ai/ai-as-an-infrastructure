// Link-rot lock: a citation URL that has been confirmed dead (HTTP 404 at its
// final effective URL, with a genuine not-found body, not an anti-bot 403) must
// never come back into refs/ or into chapter prose. Every entry in
// dead-urls.json was verified dead once; re-introducing one would ship a
// reader-facing clickable link to a 404, which is the failure this locks out.
//
// Deliberately offline: a live crawl would make the suite depend on the network
// and on publisher anti-bot behaviour. New rot gets found by an out-of-band
// sweep and added here with its replacement.

import { test, expect } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..");
const dead: string[] = JSON.parse(
  readFileSync(join(import.meta.dir, "dead-urls.json"), "utf8"),
);

// Compare the way a browser would resolve them: scheme, "www.", a trailing
// slash and case in the host are not what makes two links the same page, so a
// dead URL cannot sneak back in wearing a different one of those coats.
function normalize(url: string): string {
  return url
    .trim()
    .replace(/[).,;]+$/, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "")
    .toLowerCase();
}

const deadSet = new Set(dead.map(normalize));

test("the known-dead list is non-empty and free of duplicates", () => {
  expect(dead.length).toBeGreaterThan(0);
  expect(deadSet.size).toBe(dead.length);
});

function bibFiles(): string[] {
  const dir = join(repoRoot, "refs");
  return readdirSync(dir)
    .filter((f) => f.endsWith(".bib"))
    .map((f) => join(dir, f));
}

function qmdFiles(): string[] {
  const out: string[] = [];
  for (const lang of ["en", "zh"]) {
    const root = join(repoRoot, lang);
    for (const part of readdirSync(root)) {
      let entries: string[];
      try { entries = readdirSync(join(root, part)); } catch { continue; }
      for (const f of entries) if (f.endsWith(".qmd")) out.push(join(root, part, f));
    }
  }
  return out;
}

test("no refs/*.bib entry points at a known-dead URL", () => {
  const hits: string[] = [];
  for (const f of bibFiles()) {
    const src = readFileSync(f, "utf8");
    src.split("\n").forEach((line, i) => {
      const m = line.match(/^\s*url\s*=\s*\{([^}]+)\}/);
      if (m && deadSet.has(normalize(m[1]))) {
        hits.push(`${f.replace(repoRoot + "/", "")}:${i + 1} -> ${m[1]}`);
      }
    });
  }
  expect(hits).toEqual([]);
});

test("no chapter links to a known-dead URL", () => {
  const hits: string[] = [];
  for (const f of qmdFiles()) {
    const src = readFileSync(f, "utf8");
    src.split("\n").forEach((line, i) => {
      for (const m of line.matchAll(/https?:\/\/[^\s)\]>"'`]+/g)) {
        if (deadSet.has(normalize(m[0]))) {
          hits.push(`${f.replace(repoRoot + "/", "")}:${i + 1} -> ${m[0]}`);
        }
      }
    });
  }
  expect(hits).toEqual([]);
});
