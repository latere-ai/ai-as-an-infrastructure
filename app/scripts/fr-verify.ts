// Per-chapter gate for the Further-reading migration. Verifies one chapter
// (by slug) without rebuilding _book, so parallel workers can self-check:
//
//   bun run app/scripts/fr-verify.ts <slug>        e.g. 04-data-curation
//
// Checks:
//   1. en + zh .qmd both use the ::: {#further-reading} marker (FR swapped).
//   2. The FR rendered from refs/<slug>.bib references exactly the same set of
//      works the hand-written list did (fr-snapshot.json) — no missing, no extra.
//   3. Every inline [@key] in the chapter has an entry in refs/<slug>.bib, so
//      citations still resolve once the loader globs refs/ (entries kept out of
//      the list must be marked further={no}, not omitted).
//
// Exit 0 = PASS; exit 1 = FAIL with details.

import { parse as parseBib } from "@retorquere/bibtex-parser";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { furtherReadingEntries } from "../src/pipeline/further-reading.ts";
import { normalizeUrl } from "./fr-snapshot.ts";

const repoRoot = join(import.meta.dir, "..", "..");
const refsDir = join(repoRoot, "refs");

function qmdPath(lang: string, slug: string): string | null {
  const root = join(repoRoot, lang);
  for (const part of readdirSync(root)) {
    const p = join(root, part, `${slug}.qmd`);
    if (existsSync(p)) return p;
  }
  return null;
}

function inlineKeys(src: string): Set<string> {
  const keys = new Set<string>();
  for (const m of src.matchAll(/\[([^\]]*@[^\]]+)\]/g)) {
    for (const km of m[1].matchAll(/@([a-zA-Z][a-zA-Z0-9_:.-]+)/g)) {
      const k = km[1];
      if (!/^(sec|fig|tbl|eq)[-:]/.test(k) && !["sec", "fig", "tbl", "eq"].includes(k)) keys.add(k);
    }
  }
  return keys;
}

function verify(slug: string): { ok: boolean; problems: string[] } {
  const problems: string[] = [];
  const bibPath = join(refsDir, `${slug}.bib`);
  if (!existsSync(bibPath)) return { ok: false, problems: [`missing refs/${slug}.bib`] };

  const en = qmdPath("en", slug);
  const zh = qmdPath("zh", slug);
  if (!en) problems.push("no en .qmd found");
  if (!zh) problems.push("no zh .qmd found");
  const enSrc = en ? readFileSync(en, "utf8") : "";
  const zhSrc = zh ? readFileSync(zh, "utf8") : "";
  if (en && !enSrc.includes("{#further-reading}")) problems.push("en .qmd: missing ::: {#further-reading} marker");
  if (zh && !zhSrc.includes("{#further-reading}")) problems.push("zh .qmd: missing ::: {#further-reading} marker");

  // 2. rendered FR set == snapshot set
  const snapshot: Record<string, string[]> = JSON.parse(readFileSync(join(import.meta.dir, "..", "test", "fr-snapshot.json"), "utf8"));
  // URL-keyed comparison; drop empty (a no-URL work like a book can't be tracked
  // this way — its presence rides on the bullet order and the gloss audit).
  const rendered = new Set(furtherReadingEntries(refsDir, slug).filter((e) => e.inFurther).map((e) => normalizeUrl(e.url ?? "")).filter(Boolean));
  const baseline = new Set((snapshot[slug] ?? []).map(normalizeUrl));
  const missing = [...baseline].filter((u) => !rendered.has(u));
  const extra = [...rendered].filter((u) => !baseline.has(u));
  if (missing.length) problems.push(`FR missing works: ${missing.join(", ")}`);
  if (extra.length) problems.push(`FR has extra works (mark them further={no} if inline-only): ${extra.join(", ")}`);

  // 3. every inline [@key] has a bib entry
  const bibEntries = parseBib(readFileSync(bibPath, "utf8"), { errorHandler: () => {} }).entries;
  const bibKeys = new Set(bibEntries.map((e: any) => e.key));
  const keys = new Set([...inlineKeys(enSrc), ...inlineKeys(zhSrc)]);
  const unresolved = [...keys].filter((k) => !bibKeys.has(k));
  if (unresolved.length) problems.push(`inline [@key] with no refs/${slug}.bib entry: ${unresolved.join(", ")}`);

  // 4. no duplicate entries (same work entered twice → renders twice but the
  // URL set still matches, so set-equality above can't catch it).
  const dupKeys = bibEntries.map((e: any) => e.key).filter((k, i, a) => a.indexOf(k) !== i);
  if (dupKeys.length) problems.push(`duplicate bib keys: ${[...new Set(dupKeys)].join(", ")}`);
  const fr = furtherReadingEntries(refsDir, slug);
  const urls = fr.map((e) => normalizeUrl(e.url ?? "")).filter(Boolean);
  const dupUrls = urls.filter((u, i, a) => a.indexOf(u) !== i);
  if (dupUrls.length) problems.push(`duplicate work URLs across entries: ${[...new Set(dupUrls)].join(", ")}`);

  return { ok: problems.length === 0, problems };
}

const slug = process.argv[2];
if (!slug) { console.error("usage: fr-verify.ts <slug>"); process.exit(1); }
const { ok, problems } = verify(slug);
if (ok) { console.log(`PASS ${slug}`); process.exit(0); }
console.log(`FAIL ${slug}`);
for (const p of problems) console.log(`  - ${p}`);
process.exit(1);
