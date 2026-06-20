// Replace a chapter's hand-written "Further reading" / "延伸阅读" body with the
// refs/-driven marker. The heading stays (author/language controlled); the
// bullets between it and the next "## " heading (or EOF) become an empty
// ::: {#further-reading} slot the compiler fills from refs/<slug>.bib.
//
//   bun run app/scripts/fr-swap.ts <file.qmd> [<file.qmd> ...]
//
// Idempotent: a section already holding the marker is left untouched.

import { readFileSync, writeFileSync } from "node:fs";

const HEADING = /^##\s+(Further [Rr]eading|延伸阅读)\s*$/;

export function swapFurtherReading(src: string): { out: string; changed: boolean } {
  const lines = src.split("\n");
  const start = lines.findIndex((l) => HEADING.test(l));
  if (start < 0) return { out: src, changed: false };
  let end = lines.length;
  for (let i = start + 1; i < lines.length; i++) {
    if (/^##\s+/.test(lines[i])) { end = i; break; }
  }
  const body = lines.slice(start + 1, end);
  if (body.some((l) => l.includes("{#further-reading}"))) return { out: src, changed: false };
  const replaced = [lines[start], "", "::: {#further-reading}", ":::", ""];
  // Drop trailing blank lines the original body had before the next heading so we
  // don't accumulate blanks; keep one trailing blank if a section follows.
  const tail = lines.slice(end);
  const out = [...lines.slice(0, start), ...replaced, ...tail].join("\n").replace(/\n{3,}/g, "\n\n");
  return { out, changed: true };
}

if (import.meta.main) {
  const files = process.argv.slice(2);
  if (files.length === 0) { console.error("usage: fr-swap.ts <file.qmd> ..."); process.exit(1); }
  let n = 0;
  for (const f of files) {
    const { out, changed } = swapFurtherReading(readFileSync(f, "utf8"));
    if (changed) { writeFileSync(f, out); n++; console.log(`swapped ${f}`); }
    else console.log(`skip (no FR / already marker) ${f}`);
  }
  console.log(`done: ${n}/${files.length} swapped`);
}
