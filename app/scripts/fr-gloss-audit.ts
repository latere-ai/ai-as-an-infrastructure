// Gloss-fidelity audit for the Further-reading migration. The URL test proves
// the right WORKS are listed; this proves the right GLOSSES came across, per
// the "migrate existing only" rule:
//   - note-zh is faithful ONLY if the original zh bullet had a Chinese (CJK)
//     gloss. A note-zh whose original zh bullet was English = invented
//     translation -> should be removed (zh then renders the en note).
//   - A Chinese original gloss with no note-zh = a faithful gloss gone missing.
//
// Baseline = the commit before the migration started (d7a1314): its en/zh .qmd
// still hold the hand-written Further-reading bullets.
//
//   bun run app/scripts/fr-gloss-audit.ts            # report all migrated chapters
//   bun run app/scripts/fr-gloss-audit.ts <slug>     # one chapter

import { parse as parseBib } from "@retorquere/bibtex-parser";
import { execFileSync } from "node:child_process";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
import { normalizeUrl } from "./fr-snapshot.ts";

const BASELINE = "d7a1314";
const repoRoot = join(import.meta.dir, "..", "..");
const refsDir = join(repoRoot, "refs");
const hasCJK = (s: string) => /[㐀-鿿　-〿＀-￯]/.test(s);

function gitShow(rev: string, path: string): string | null {
  try { return execFileSync("git", ["show", `${rev}:${path}`], { cwd: repoRoot, encoding: "utf8" }); }
  catch { return null; }
}

function enPath(slug: string): string | null {
  const root = join(repoRoot, "en");
  for (const part of readdirSync(root)) if (existsSync(join(root, part, `${slug}.qmd`))) return `en/${part}/${slug}.qmd`;
  return null;
}

// Per work URL -> the full bullet text (links stripped), so a gloss is detected
// whether it's parenthetical ("Title" (gloss)) or a trailing clause
// (". Gloss." / "，gloss。"). Faithfulness is then checked by substring
// containment of the migrated note in this original text.
function glossesByUrl(src: string): Map<string, string> {
  const out = new Map<string, string>();
  const lines = src.split("\n");
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+(Further [Rr]eading|延伸阅读)\s*$/.test(line)) { inSection = true; continue; }
    if (inSection && /^##\s+/.test(line)) break;
    if (!inSection || !line.trim().startsWith("-")) continue;
    const noLinks = line.replace(/\[[^\]]*\]\([^)]*\)/g, "");
    const urls = [...line.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => normalizeUrl(m[1]));
    for (const u of urls) out.set(u, noLinks);
  }
  return out;
}

// Loose containment: drop spaces and the punctuation that legitimately varies
// between a bullet and a bib note ( , . ; （ ） ASCII/full-width ) so a
// faithfully-migrated note still matches its source clause.
const squash = (s: string) => s.replace(/[\s,.;:，。；：（）()`*]/g, "").toLowerCase();
const contains = (haystack: string, needle: string) => squash(haystack).includes(squash(needle));

interface Finding { slug: string; kind: "INVENTED-ZH" | "INVENTED-EN" | "MISSING-ZH"; key: string; detail: string }

function audit(slug: string): Finding[] {
  const findings: Finding[] = [];
  const ep = enPath(slug);
  const bibPath = join(refsDir, `${slug}.bib`);
  if (!ep || !existsSync(bibPath)) return findings;
  const zp = ep.replace(/^en\//, "zh/");
  const enSrc = gitShow(BASELINE, ep), zhSrc = gitShow(BASELINE, zp);
  if (!enSrc || !zhSrc) return findings;
  const enG = glossesByUrl(enSrc), zhG = glossesByUrl(zhSrc);

  const lib = parseBib(readFileSync(bibPath, "utf8"), { errorHandler: () => {}, sentenceCase: false });
  for (const e of lib.entries) {
    const f = e.fields as Record<string, any>;
    const eprint = f.eprint ? String(f.eprint) : undefined;
    const url = f.url ? normalizeUrl(String(f.url)) : eprint ? `arxiv:${eprint}` : "";
    const note = f.note ? String(f.note) : undefined;
    const noteZh = f["note-zh"] ? String(f["note-zh"]) : undefined;
    const origZh = zhG.get(url) ?? "";
    const origEn = enG.get(url) ?? "";
    // note-zh is faithful iff its text appears in the original zh bullet.
    if (noteZh && !contains(origZh, noteZh)) {
      findings.push({ slug, kind: "INVENTED-ZH", key: e.key, detail: `note-zh={${noteZh}} not found in original zh bullet` });
    }
    // note (en) is faithful iff its text appears in the original en bullet.
    if (note && !contains(origEn, note)) {
      findings.push({ slug, kind: "INVENTED-EN", key: e.key, detail: `note={${note}} not found in original en bullet` });
    }
    // A Chinese gloss in the original zh bullet that wasn't carried to note-zh
    // (so zh wrongly renders the en note). origZh's only CJK is its gloss.
    if (!noteZh && hasCJK(origZh) && !contains(origEn, origZh)) {
      findings.push({ slug, kind: "MISSING-ZH", key: e.key, detail: `original zh bullet has a Chinese gloss but entry has no note-zh` });
    }
  }
  return findings;
}

function migratedSlugs(): string[] {
  const out: string[] = [];
  const root = join(repoRoot, "en");
  for (const part of readdirSync(root)) {
    let fs: string[]; try { fs = readdirSync(join(root, part)); } catch { continue; }
    for (const fn of fs) {
      if (!/^\d+-.*\.qmd$/.test(fn)) continue;
      if (readFileSync(join(root, part, fn), "utf8").includes("{#further-reading}")) out.push(basename(fn, ".qmd"));
    }
  }
  return out.sort();
}

const only = process.argv[2];
const slugs = only ? [only] : migratedSlugs();
let n = 0;
for (const s of slugs) {
  const fs = audit(s);
  if (fs.length) { n += fs.length; for (const f of fs) console.log(`${f.kind}  ${f.slug}  ${f.key}: ${f.detail}`); }
}
console.log(`\n${n} gloss findings across ${slugs.length} chapters`);
