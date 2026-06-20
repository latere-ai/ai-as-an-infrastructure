// Per-chapter "Further reading" rendered from refs/<slug>.bib. refs/ is the
// single source of truth for the book's literature: each chapter's .bib lists
// the works in reading order, and this module turns them into the bullet list
// that fills the chapter's ::: {#further-reading} slot. Bilingual glosses live
// on the entry as `note` (en) and `note-zh` (zh).
//
// Format (uniform): Author et al., "Title" (gloss), year. [arXiv:ID](url)
//   - 1 author → "Surname"; 2 → "A & B"; 3+ → "A et al."; corporate → verbatim.
//   - with gloss → `"Title" (gloss), year.`; without → `"Title," year.`
//   - link text → "arXiv:ID" for arXiv, else the bare host.

import { parse as parseBib } from "@retorquere/bibtex-parser";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import type { Lang } from "../types.ts";

export interface FurtherReadingEntry {
  key: string;
  authors: string[]; // surnames in order
  year: string;
  title: string;
  url?: string;
  eprint?: string;
  note?: string; // en gloss
  noteZh?: string; // zh gloss
}

function surname(name: { lastName?: string; firstName?: string; name?: string }): string {
  if (name.lastName) return name.lastName;
  if (name.name) return name.name.split(/\s+/).slice(-1)[0];
  return "?";
}

// Entries of one chapter's bib, in file order. Returns [] if the chapter has no
// .bib yet (so an un-backfilled chapter renders an empty list rather than crash).
export function furtherReadingEntries(refsDir: string, slug: string): FurtherReadingEntry[] {
  const path = join(refsDir, `${slug}.bib`);
  if (!existsSync(path)) return [];
  // sentenceCase:false keeps the authors' original title casing ("Scaling Laws
  // for…", not "Scaling laws for…"), matching the hand-written further reading.
  const lib = parseBib(readFileSync(path, "utf8"), { errorHandler: () => {}, sentenceCase: false });
  return lib.entries.map((e: { key: string; fields: Record<string, any> }) => {
    const f = e.fields as Record<string, any>;
    const authors: string[] = Array.isArray(f.author) ? f.author.map((a: any) => surname(a)) : [];
    const eprint = f.eprint ? String(f.eprint) : undefined;
    return {
      key: e.key,
      authors,
      year: String(f.year ?? f.date ?? "").match(/\d{4}/)?.[0] ?? "n.d.",
      title: String(f.title ?? "").replace(/[{}]/g, ""),
      url: f.url ? String(f.url) : eprint ? `https://arxiv.org/abs/${eprint}` : undefined,
      eprint,
      note: f.note ? String(f.note) : undefined,
      noteZh: f["note-zh"] ? String(f["note-zh"]) : undefined,
    };
  });
}

function authorsLabel(authors: string[]): string {
  if (authors.length === 0) return "";
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return `${authors[0]} et al.`;
}

function linkText(e: FurtherReadingEntry): string {
  const id = e.eprint || e.url?.match(/arxiv\.org\/(?:abs|pdf)\/([0-9]{4}\.[0-9]+)/i)?.[1];
  if (id) return `arXiv:${id}`;
  if (!e.url) return "link";
  return e.url.replace(/^https?:\/\//i, "").replace(/^www\./i, "").split("/")[0];
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function renderEntry(e: FurtherReadingEntry, lang: Lang): string {
  const gloss = (lang === "zh" ? e.noteZh : e.note) ?? (lang === "zh" ? e.note : undefined);
  const authors = e.authors.length ? `${esc(authorsLabel(e.authors))}, ` : "";
  const titlePart = gloss
    ? `&ldquo;${esc(e.title)}&rdquo; (${esc(gloss)}),`
    : `&ldquo;${esc(e.title)},&rdquo;`;
  const link = e.url ? ` <a href="${esc(e.url)}" rel="noopener">${esc(linkText(e))}</a>` : "";
  return `<li>${authors}${titlePart} ${e.year}.${link}</li>`;
}

// HTML <ul> that fills the ::: {#further-reading} slot for a chapter.
export function renderFurtherReading(refsDir: string, slug: string, lang: Lang): string {
  const entries = furtherReadingEntries(refsDir, slug);
  if (entries.length === 0) return "";
  return `<ul class="rdr-further-reading">\n${entries.map((e) => renderEntry(e, lang)).join("\n")}\n</ul>`;
}
