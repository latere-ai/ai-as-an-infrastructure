// One-shot migration baseline: extract the set of works (normalized source URLs)
// referenced in each chapter's hand-written "Further reading" / "延伸阅读"
// section, BEFORE those sections are converted to refs/-driven rendering.
//
// The result (app/test/fr-snapshot.json) is the safety net the further-reading
// test diffs against: a chapter rendered from refs/ must reference exactly the
// same set of works it did when hand-written. Run once from en (URLs are
// language-neutral); commit the JSON. Re-run only to intentionally re-baseline.
//
//   bun run app/scripts/fr-snapshot.ts

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..");
const enRoot = join(repoRoot, "en");

// Normalize a source URL to a stable identity so en/zh and bib/prose agree:
// arXiv abstracts collapse to "arxiv:ID"; everything else loses protocol,
// "www.", and any trailing slash, lowercased.
export function normalizeUrl(url: string): string {
  const u = url.trim().replace(/[).,;]+$/, "");
  const arxiv = u.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]+)/i) || u.match(/^arxiv:([0-9]{4}\.[0-9]+)/i);
  if (arxiv) return `arxiv:${arxiv[1]}`;
  return u.replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/$/, "").toLowerCase();
}

// All markdown-link URLs inside the Further-reading section of one chapter, in
// document order, de-duplicated.
export function extractFurtherReadingUrls(src: string): string[] {
  const lines = src.split("\n");
  const urls: string[] = [];
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+(Further [Rr]eading|延伸阅读)\s*$/.test(line)) { inSection = true; continue; }
    if (inSection && /^##\s+/.test(line)) break; // next section ends it
    if (!inSection) continue;
    for (const m of line.matchAll(/\]\((https?:\/\/[^)]+)\)/g)) urls.push(normalizeUrl(m[1]));
  }
  return [...new Set(urls)];
}

function chapterFiles(): string[] {
  const out: string[] = [];
  for (const part of readdirSync(enRoot)) {
    const dir = join(enRoot, part);
    let entries: string[];
    try { entries = readdirSync(dir); } catch { continue; }
    for (const f of entries) if (/^\d+-.*\.qmd$/.test(f)) out.push(join(dir, f));
  }
  return out.sort();
}

if (import.meta.main) {
  const snapshot: Record<string, string[]> = {};
  for (const f of chapterFiles()) {
    const slug = basename(f, ".qmd");
    snapshot[slug] = extractFurtherReadingUrls(readFileSync(f, "utf8"));
  }
  const outPath = join(import.meta.dir, "..", "test", "fr-snapshot.json");
  writeFileSync(outPath, JSON.stringify(snapshot, null, 2) + "\n");
  const total = Object.values(snapshot).reduce((n, a) => n + a.length, 0);
  console.log(`wrote ${outPath}: ${Object.keys(snapshot).length} chapters, ${total} works`);
}
