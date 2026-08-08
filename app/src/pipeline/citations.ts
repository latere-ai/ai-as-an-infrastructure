// Citation engine: parse the merged refs/*.bib once, resolve [@key] / [@a; @b] / bare
// @key to author-year links, and render a cited-only bibliography (the content
// for references.qmd's ::: {#refs} slot). Author-date style, Chicago-ish.

import { parse as parseBib } from "@retorquere/bibtex-parser";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { Lang } from "../types.ts";

export interface BibEntry {
  key: string;
  authors: string[]; // surnames in order
  year: string;
  title: string;
  publisher?: string;
  url?: string;
  tldr?: string; // one-sentence "what this paper is about", en
  tldrZh?: string; // the zh twin
  raw: Record<string, string>;
}

export interface Bibliography {
  entries: Map<string, BibEntry>;
  cited: Set<string>; // populated as chapters render
}

function surname(name: { lastName?: string; firstName?: string; name?: string }): string {
  if (name.lastName) return name.lastName;
  // A literal/corporate author (bibtex `{{Google DeepMind}}`) parses as a whole
  // `name` with no first/last split; use it verbatim. Taking the last token here
  // would mangle it ("DeepMind", "Face", "AI", "Biases").
  if (name.name) return name.name;
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
    // The same work recurs across chapter bibs; bibliographic fields are
    // last-wins (later files may carry corrected metadata), but the tldr is
    // carried forward from whichever copy defines it, so a tldr written in any
    // one chapter's bib survives the merge regardless of filename sort order.
    const prev = entries.get(e.key);
    entries.set(e.key, {
      key: e.key,
      authors,
      year,
      title: String(f.title ?? "").replace(/[{}]/g, ""),
      publisher: f.publisher ? String(f.publisher) : f.journal ? String(f.journal) : undefined,
      url: f.url ? String(f.url) : f.eprint ? `https://arxiv.org/abs/${f.eprint}` : undefined,
      tldr: (f.tldr ? String(f.tldr) : undefined) ?? prev?.tldr,
      tldrZh: (f["tldr-zh"] ? String(f["tldr-zh"]) : undefined) ?? prev?.tldrZh,
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

// Full bibliography list, cited-only, sorted by first author then year. `lang`
// picks the TL;DR language (zh falls back to the en tldr until translated).
export function renderBibliography(bib: Bibliography, lang: Lang = "en"): string {
  const cited = [...bib.cited].map((k) => bib.entries.get(k)).filter((e): e is BibEntry => !!e);
  cited.sort((a, b) => (a.authors[0] ?? "").localeCompare(b.authors[0] ?? "") || a.year.localeCompare(b.year));
  // Chapters sometimes cite one source through different historical keys. A
  // shared URL identifies those aliases without conflating unlinked works.
  // Keep every fragment target so an inline citation still lands here, but
  // present the source once to the reader.
  const sources = new Map<string, { entry: BibEntry; keys: string[] }>();
  for (const entry of cited) {
    const identity = entry.url ? `url:${entry.url.replace(/\/+$/, "")}` : `key:${entry.key}`;
    const source = sources.get(identity);
    if (source) source.keys.push(entry.key);
    else sources.set(identity, { entry, keys: [entry.key] });
  }
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
  const items = [...sources.values()].map(({ entry: e, keys }) => {
    // Lead each entry with the same "[Author et al. Year]" label the inline
    // @cite renders, so a reader can match an in-text citation to its entry.
    const label = `[${esc(authorShort(e))} ${e.year}]`;
    const authors = e.authors.length ? esc(e.authors.join(", ")) : "";
    const url = e.url ? ` <a href="${e.url}" rel="noopener">${esc(e.url)}</a>` : "";
    const pub = e.publisher ? ` ${esc(e.publisher)}.` : "";
    const meta = authors ? `<span class="rdr-ref-meta">${authors}.</span> ` : "";
    // One-sentence "what this paper is about", a TL;DR before clicking through.
    const tldrText = lang === "zh" ? e.tldrZh ?? e.tldr : e.tldr;
    const tldr = tldrText ? `<div class="rdr-ref-tldr">${esc(tldrText)}</div>` : "";
    const aliases = keys
      .filter((key) => key !== e.key)
      .map((key) => `<span class="rdr-ref-alias" id="ref-${key}" aria-hidden="true"></span>`)
      .join("");
    return `<div class="rdr-ref" id="ref-${e.key}">${aliases}<span class="rdr-ref-key">${label}</span> ${meta}<span class="rdr-ref-title">${esc(e.title)}.</span>${pub}${url}${tldr}</div>`;
  });
  return `<div class="rdr-refs">${items.join("\n")}</div>`;
}
