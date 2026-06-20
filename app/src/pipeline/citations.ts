// Citation engine: parse references.bib once, resolve [@key] / [@a; @b] / bare
// @key to author-year links, and render a cited-only bibliography (the content
// for references.qmd's ::: {#refs} slot). Author-date style, Chicago-ish.

import { parse as parseBib } from "@retorquere/bibtex-parser";
import { readFileSync } from "node:fs";

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

export function loadBibliography(bibPath: string): Bibliography {
  const lib = parseBib(readFileSync(bibPath, "utf8"), { errorHandler: () => {} });
  const entries = new Map<string, BibEntry>();
  for (const e of lib.entries) {
    const f = e.fields as Record<string, any>;
    const authors: string[] = Array.isArray(f.author)
      ? f.author.map((a: any) => surname(a))
      : [];
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
    `<a href="${prefix}references.html#ref-${e.key}" class="rdr-cite">${text}</a>`;
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
    const authors = e.authors.length ? esc(e.authors.join(", ")) : "";
    const url = e.url ? ` <a href="${e.url}" rel="noopener">${esc(e.url)}</a>` : "";
    const pub = e.publisher ? ` ${esc(e.publisher)}.` : "";
    return `<div class="rdr-ref" id="ref-${e.key}"><span class="rdr-ref-meta">${authors}${authors ? ". " : ""}${e.year}.</span> <span class="rdr-ref-title">${esc(e.title)}.</span>${pub}${url}</div>`;
  });
  return `<div class="rdr-refs">${items.join("\n")}</div>`;
}
