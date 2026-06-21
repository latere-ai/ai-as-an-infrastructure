// Capture the hand-written Further-reading SECTION text (en + zh) of every
// chapter that is still prose, so the gloss-audit has a baseline for chapters
// that postdate the git baseline commit (d7a1314) — new chapters added by the
// restructure never existed there, so git can't supply their original glosses.
// Run BEFORE migrating those chapters (once their FR becomes a marker, the
// bullets are gone). Merge-preserves existing entries.
//
//   bun run app/scripts/fr-gloss-baseline.ts

import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const repoRoot = join(import.meta.dir, "..", "..");

// The Further-reading section text incl. its heading (so the audit's parser can
// find it), from the heading to the next "## " heading or EOF. "" if none.
export function furtherReadingSection(src: string): string {
  const lines = src.split("\n");
  const start = lines.findIndex((l) => /^##\s+(Further [Rr]eading|延伸阅读)\s*$/.test(l));
  if (start < 0) return "";
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) if (/^##\s+/.test(lines[i])) { end = i; break; }
  return lines.slice(start, end).join("\n");
}

function chapterFiles(lang: string): string[] {
  const out: string[] = [];
  const root = join(repoRoot, lang);
  for (const part of readdirSync(root)) {
    let entries: string[];
    try { entries = readdirSync(join(root, part)); } catch { continue; }
    for (const f of entries) if (/^\d+-.*\.qmd$/.test(f)) out.push(join(root, part, f));
  }
  return out;
}

if (import.meta.main) {
  const outPath = join(import.meta.dir, "..", "test", "fr-gloss-baseline.json");
  const existing: Record<string, { en: string; zh: string }> = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf8")) : {};
  const out = { ...existing };
  let n = 0;
  for (const enFile of chapterFiles("en")) {
    const slug = basename(enFile, ".qmd");
    const enSrc = readFileSync(enFile, "utf8");
    if (enSrc.includes("{#further-reading}")) continue; // already migrated → keep any existing baseline
    const zhFile = enFile.replace(`${repoRoot}/en/`, `${repoRoot}/zh/`);
    const zhSrc = existsSync(zhFile) ? readFileSync(zhFile, "utf8") : "";
    out[slug] = { en: furtherReadingSection(enSrc), zh: furtherReadingSection(zhSrc) };
    n++;
  }
  const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
  writeFileSync(outPath, JSON.stringify(sorted, null, 2) + "\n");
  console.log(`wrote ${outPath}: ${Object.keys(sorted).length} chapters (${n} (re)captured)`);
}
