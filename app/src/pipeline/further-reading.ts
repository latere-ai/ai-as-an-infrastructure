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
import { resolveXrefsInText, type CrossrefMap } from "./crossref.ts";

export interface FurtherReadingEntry {
  key: string;
  type: string; // bib entry type: book, article, misc, inproceedings, …
  authors: string[]; // surnames in order
  authorsFull: string[]; // "Surname, First" in order (for book style)
  year: string;
  title: string;
  publisher?: string;
  url?: string;
  eprint?: string;
  note?: string; // en gloss
  noteZh?: string; // zh gloss
  inFurther: boolean; // false → cited inline but kept out of Further reading
}

function surname(name: { lastName?: string; firstName?: string; name?: string }): string {
  if (name.lastName) return name.lastName;
  // Literal/corporate author ("{{Google DeepMind}}"): use the whole name, not
  // the last token, so it reads "Google DeepMind" not "DeepMind".
  if (name.name) return name.name;
  return "?";
}

function fullName(name: { lastName?: string; firstName?: string; name?: string }): string {
  if (name.lastName) return name.firstName ? `${name.lastName}, ${name.firstName}` : name.lastName;
  return name.name ?? "?";
}

// Entries of one chapter's bib, in file order. Returns [] if the chapter has no
// .bib yet (so an un-backfilled chapter renders an empty list rather than crash).
export function furtherReadingEntries(refsDir: string, slug: string): FurtherReadingEntry[] {
  const path = join(refsDir, `${slug}.bib`);
  if (!existsSync(path)) return [];
  // sentenceCase:false keeps the authors' original title casing ("Scaling Laws
  // for…", not "Scaling laws for…"), matching the hand-written further reading.
  const lib = parseBib(readFileSync(path, "utf8"), { errorHandler: () => {}, sentenceCase: false });
  return lib.entries.map((e: { key: string; type?: string; fields: Record<string, any> }) => {
    const f = e.fields as Record<string, any>;
    // Edited volumes carry names under `editor`, not `author`; fall back so the
    // entry still leads with people rather than just a title.
    const authorList: any[] = Array.isArray(f.author) ? f.author : Array.isArray(f.editor) ? f.editor : [];
    const eprint = f.eprint ? String(f.eprint) : undefined;
    return {
      key: e.key,
      type: String(e.type ?? "misc").toLowerCase(),
      authors: authorList.map((a) => surname(a)),
      authorsFull: authorList.map((a) => fullName(a)),
      year: String(f.year ?? f.date ?? "").match(/\d{4}/)?.[0] ?? "n.d.",
      title: String(f.title ?? "").replace(/[{}]/g, ""),
      publisher: f.publisher ? String(f.publisher) : undefined,
      url: f.url ? String(f.url) : eprint ? `https://arxiv.org/abs/${eprint}` : undefined,
      eprint,
      note: f.note ? String(f.note) : undefined,
      noteZh: f["note-zh"] ? String(f["note-zh"]) : undefined,
      // An entry that exists only to back an inline [@key] is marked
      // `further = {no}` so it resolves citations but stays out of the list.
      inFurther: !["no", "false", "0"].includes(String(f.further ?? "").toLowerCase()),
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

function renderEntry(e: FurtherReadingEntry, lang: Lang, xref: CrossrefMap, currentHref: string, prefix: string): string {
  // zh prefers the zh gloss, falling back to the en gloss; en uses the en gloss.
  const gloss = (lang === "zh" ? e.noteZh ?? e.note : e.note);
  // Resolve @sec-/@fig- cross-refs that a gloss may carry, on the escaped text.
  const glossPart = gloss ? ` (${resolveXrefsInText(esc(gloss), xref, currentHref, prefix)})` : "";
  const link = e.url ? ` <a href="${esc(e.url)}" rel="noopener">${esc(linkText(e))}</a>` : "";

  // Books: Chicago-ish "Surname, First. *Title.* Publisher, year. [host]".
  if (e.type === "book") {
    const authors = e.authorsFull.length ? `${esc(e.authorsFull.join("; "))}. ` : "";
    const pub = e.publisher ? `${esc(e.publisher)}, ` : "";
    return `<li>${authors}<em>${esc(e.title)}</em>${glossPart}. ${pub}${e.year}.${link}</li>`;
  }

  // Papers and everything else: 'Surname et al., "Title" (gloss), year. [link]'.
  const authors = e.authors.length ? `${esc(authorsLabel(e.authors))}, ` : "";
  const titlePart = gloss
    ? `&ldquo;${esc(e.title)}&rdquo;${glossPart},`
    : `&ldquo;${esc(e.title)},&rdquo;`;
  return `<li>${authors}${titlePart} ${e.year}.${link}</li>`;
}

// HTML <ul> that fills the ::: {#further-reading} slot for a chapter.
export function renderFurtherReading(refsDir: string, slug: string, lang: Lang, xref: CrossrefMap, currentHref: string, prefix: string): string {
  const entries = furtherReadingEntries(refsDir, slug).filter((e) => e.inFurther);
  if (entries.length === 0) return "";
  return `<ul class="rdr-further-reading">\n${entries.map((e) => renderEntry(e, lang, xref, currentHref, prefix)).join("\n")}\n</ul>`;
}
