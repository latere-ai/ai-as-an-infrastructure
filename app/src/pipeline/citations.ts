// Citation engine: parse the merged refs/*.bib once, resolve [@key] / [@a; @b] / bare
// @key to author-year links, and render a cited-only bibliography (the content
// for references.qmd's ::: {#refs} slot). Author-date style, Chicago-ish.

import { parse as parseBib } from "@retorquere/bibtex-parser";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface BibEntry {
  key: string;
  authors: string[]; // surnames in order
  year: string;
  title: string;
  publisher?: string;
  url?: string;
  raw: Record<string, string>;
}

export interface Bibliography {
  entries: Map<string, BibEntry>;
  cited: Set<string>; // populated as chapters render
}

function surname(name: { lastName?: string; firstName?: string; name?: string }): string {
  if (name.lastName) return name.lastName;
  if (name.name) return name.name.split(/\s+/).slice(-1)[0];
  return "?";
}

function addEntries(entries: Map<string, BibEntry>, content: string): void {
  const lib = parseBib(content, { errorHandler: () => {} });
  for (const e of lib.entries) {
    const f = e.fields as Record<string, any>;
    // Edited volumes (e.g. an @book with `editor` and no `author`) still need a
    // name for the citation label; fall back to the editors so the inline cite
    // reads "Beyer et al. 2016" rather than the bare bibtex key.
    const people: any[] = Array.isArray(f.author) ? f.author : Array.isArray(f.editor) ? f.editor : [];
    const authors: string[] = people.map((a: any) => surname(a));
    const year = String(f.year ?? f.date ?? "").match(/\d{4}/)?.[0] ?? "n.d.";
    const flat = (v: any): string => Array.isArray(v) ? v.map(flat).join(", ") : (v?.lastName ? `${v.lastName}` : String(v ?? ""));
    entries.set(e.key, {
      key: e.key,
      authors,
      year,
      title: String(f.title ?? "").replace(/[{}]/g, ""),
      publisher: f.publisher ? String(f.publisher) : f.journal ? String(f.journal) : undefined,
      url: f.url ? String(f.url) : f.eprint ? `https://arxiv.org/abs/${f.eprint}` : undefined,
      raw: Object.fromEntries(Object.entries(f).map(([k, v]) => [k, flat(v)])),
    });
  }
}

export function loadBibliography(bibPath: string): Bibliography {
  const entries = new Map<string, BibEntry>();
  addEntries(entries, readFileSync(bibPath, "utf8"));
  return { entries, cited: new Set() };
}

// Merge every refs/<chapter>.bib into one bibliography (refs/ is the source of
// truth). Keys repeated across chapters collapse to one entry (sorted filename
// order, last wins); duplicates are the same work, so this is the dedup.
export function loadBibliographyDir(dir: string): Bibliography {
  const entries = new Map<string, BibEntry>();
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".bib")).sort()) {
    addEntries(entries, readFileSync(join(dir, f), "utf8"));
  }
  return { entries, cited: new Set() };
}

// "Touvron et al." / "Ba and Frankle" / "Kaplan"
function authorShort(e: BibEntry): string {
  const a = e.authors;
  if (a.length === 0) return e.key;
  if (a.length === 1) return a[0];
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a[0]} et al.`;
}

export interface CiteToken {
  keys: string[];
  bare: boolean; // bare @key (in-text "Author (Year)") vs bracketed "(Author Year)"
}

export function renderCite(bib: Bibliography, tok: CiteToken, prefix = ""): string {
  const link = (e: BibEntry, text: string) =>
    `<a href="${prefix}references#ref-${e.key}" class="rdr-cite">${text}</a>`;
  const parts = tok.keys.map((k) => {
    const e = bib.entries.get(k);
    if (!e) return `<span class="rdr-cite rdr-cite-missing">?${k}</span>`;
    bib.cited.add(k);
    if (tok.bare) return link(e, `${authorShort(e)} (${e.year})`);
    return link(e, `${authorShort(e)} ${e.year}`);
  });
  if (tok.bare) return parts.join("; ");
  return `(${parts.join("; ")})`;
}

// Full bibliography list, cited-only, sorted by first author then year.
export function renderBibliography(bib: Bibliography): string {
  const cited = [...bib.cited].map((k) => bib.entries.get(k)).filter((e): e is BibEntry => !!e);
  cited.sort((a, b) => (a.authors[0] ?? "").localeCompare(b.authors[0] ?? "") || a.year.localeCompare(b.year));
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const items = cited.map((e) => {
    // Lead each entry with the same "[Author et al. Year]" label the inline
    // @cite renders, so a reader can match an in-text citation to its entry.
    const label = `[${esc(authorShort(e))} ${e.year}]`;
    const authors = e.authors.length ? esc(e.authors.join(", ")) : "";
    const url = e.url ? ` <a href="${e.url}" rel="noopener">${esc(e.url)}</a>` : "";
    const pub = e.publisher ? ` ${esc(e.publisher)}.` : "";
    const meta = authors ? `<span class="rdr-ref-meta">${authors}.</span> ` : "";
    return `<div class="rdr-ref" id="ref-${e.key}"><span class="rdr-ref-key">${label}</span> ${meta}<span class="rdr-ref-title">${esc(e.title)}.</span>${pub}${url}</div>`;
  });
  return `<div class="rdr-refs">${items.join("\n")}</div>`;
}
