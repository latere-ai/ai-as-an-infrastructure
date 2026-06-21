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
const baselinePath = join(import.meta.dir, "..", "test", "fr-gloss-baseline.json");
const BASELINE_GLOSS: Record<string, { en: string; zh: string }> = existsSync(baselinePath) ? JSON.parse(readFileSync(baselinePath, "utf8")) : {};
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

// One Further-reading bullet: its work URLs and its text (links stripped), so a
// gloss is detected whether parenthetical ("Title" (gloss)) or a trailing clause
// (". Gloss." / "，gloss。").
interface Bullet { urls: string[]; text: string }

function bullets(src: string): Bullet[] {
  const out: Bullet[] = [];
  const lines = src.split("\n");
  let inSection = false;
  for (const line of lines) {
    if (/^##\s+(Further [Rr]eading|延伸阅读)\s*$/.test(line)) { inSection = true; continue; }
    if (inSection && /^##\s+/.test(line)) break;
    if (!inSection || !line.trim().startsWith("-")) continue;
    out.push({
      urls: [
        ...[...line.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].map((m) => normalizeUrl(m[1])),
        ...[...line.matchAll(/<(https?:\/\/[^>]+)>/g)].map((m) => normalizeUrl(m[1])),
      ],
      text: line.replace(/\[[^\]]*\]\([^)]*\)/g, "").replace(/<https?:\/\/[^>]+>/g, ""),
    });
  }
  return out;
}

// The original bullet text for an entry: match by URL when it has one, else
// (a book/doc with no link) by its first-author surname or a distinctive title
// word appearing in the bullet. "" if no bullet matches.
function bulletFor(bs: Bullet[], url: string, authorSurname: string, title: string): string {
  if (url) { const b = bs.find((x) => x.urls.includes(url)); if (b) return b.text; }
  const titleWord = (title.match(/[A-Za-z]{5,}/) ?? [""])[0];
  const b = bs.find((x) => (authorSurname && x.text.includes(authorSurname)) || (titleWord && x.text.includes(titleWord)));
  return b ? b.text : "";
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
  // Prefer the pre-migration gloss baseline (covers chapters that postdate the
  // git baseline commit); fall back to d7a1314 for the originally-migrated set.
  const base = BASELINE_GLOSS[slug];
  const enSrc = base ? base.en : gitShow(BASELINE, ep);
  const zhSrc = base ? base.zh : gitShow(BASELINE, zp);
  if (!enSrc || !zhSrc) return findings;
  const enB = bullets(enSrc), zhB = bullets(zhSrc);

  const lib = parseBib(readFileSync(bibPath, "utf8"), { errorHandler: () => {}, sentenceCase: false });
  for (const e of lib.entries) {
    const f = e.fields as Record<string, any>;
    const eprint = f.eprint ? String(f.eprint) : undefined;
    const url = f.url ? normalizeUrl(String(f.url)) : eprint ? `arxiv:${eprint}` : "";
    const note = f.note ? String(f.note) : undefined;
    const noteZh = f["note-zh"] ? String(f["note-zh"]) : undefined;
    const author0 = Array.isArray(f.author) && f.author[0] ? (f.author[0].lastName ?? f.author[0].name ?? "") : "";
    const title = String(f.title ?? "").replace(/[{}]/g, "");
    const origEn = bulletFor(enB, url, author0, title);
    const origZh = bulletFor(zhB, url, author0, title);
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
