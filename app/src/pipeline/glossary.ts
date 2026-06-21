// Glossary engine: a \ref-style mechanism for professional terms. Authors write
// @gls-<key> in the .qmd; the inline-ref rule resolves it against
// glossary.yml. First use in a chapter expands to the full term plus its English
// original in parens (e.g. 混合专家（MoE） / mixture-of-experts (MoE)); later uses
// in the same chapter show the short form. Every use links to the auto-generated
// glossary page. Terms are defined once in glossary.yml, never maintained by hand
// in the prose.

import { parse as parseYaml } from "yaml";
import { readFileSync, existsSync } from "node:fs";
import type { Lang } from "../types.ts";

export interface GlossEntry {
  key: string;
  en: string; // full English term, e.g. "mixture-of-experts"
  zh: string; // full Chinese term, e.g. "混合专家"
  abbr?: string; // language-neutral abbreviation, e.g. "MoE"
}
export type Glossary = Map<string, GlossEntry>;

export interface GlossFirstUse {
  key: string;
  href: string;
  title: string;
  chapterNum: string;
  sentence: string;
}
export type GlossFirstUseMap = Map<string, GlossFirstUse>;

export function loadGlossary(path: string): Glossary {
  const m: Glossary = new Map();
  if (!existsSync(path)) return m;
  const raw = (parseYaml(readFileSync(path, "utf8")) ?? {}) as Record<string, any>;
  for (const [key, v] of Object.entries(raw)) {
    if (!v || typeof v !== "object") continue;
    m.set(key, { key, en: String(v.en ?? ""), zh: String(v.zh ?? ""), abbr: v.abbr != null ? String(v.abbr) : undefined });
  }
  return m;
}

// Per-language surface forms.
//  full  – the term in this language
//  paren – what to show in parens on first use (the cross-language original /
//          abbreviation): zh always glosses with the English; en glosses with
//          the abbreviation only when it differs from the term.
//  short – later-use form: the abbreviation if there is one, else the full term.
function forms(e: GlossEntry, lang: Lang): { full: string; paren: string | null; short: string } {
  const full = lang === "zh" ? e.zh : e.en;
  const paren = lang === "zh" ? (e.abbr || e.en) : (e.abbr && e.abbr !== e.en ? e.abbr : null);
  const short = e.abbr || full;
  return { full, paren, short };
}

export function renderGlossText(e: GlossEntry, lang: Lang, first: boolean): string {
  const { full, paren, short } = forms(e, lang);
  const open = lang === "zh" ? "（" : " (";
  const close = lang === "zh" ? "）" : ")";
  return first ? (paren ? `${full}${open}${paren}${close}` : full) : short;
}

// Render an inline @gls reference. `first` = first use of this key in the chapter.
export function renderGloss(e: GlossEntry, lang: Lang, first: boolean, prefix: string): string {
  return `<a href="${prefix}glossary#gls-${e.key}" class="rdr-gls">${renderGlossText(e, lang, first)}</a>`;
}

// The glossary page body: every used term, sorted, each with a {#gls-key} anchor.
// On the zh page the Chinese term leads; on en, the English leads.
export function renderGlossaryPage(gloss: Glossary, used: Set<string>, firstUses: GlossFirstUseMap, lang: Lang): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escAttr = (s: string) => esc(s).replace(/"/g, "&quot;");
  const chapterLabel = (u: GlossFirstUse) =>
    u.chapterNum ? `${lang === "zh" ? `第 ${u.chapterNum} 章` : `Chapter ${u.chapterNum}`} · ${esc(u.title)}` : esc(u.title);
  const entries = [...used].map((k) => gloss.get(k)).filter((e): e is GlossEntry => !!e);
  entries.sort((a, b) => (lang === "zh" ? a.zh.localeCompare(b.zh, "zh") : a.en.localeCompare(b.en)));
  const items = entries.map((e) => {
    const enLabel = e.abbr && e.abbr !== e.en ? `${esc(e.en)} (${esc(e.abbr)})` : esc(e.en);
    const lead = lang === "zh" ? esc(e.zh) : enLabel;
    const trail = lang === "zh" ? enLabel : esc(e.zh);
    const first = firstUses.get(e.key);
    const firstHref = first ? (first.href === "index" ? "./" : first.href) : "";
    const firstMeta = first
      ? `<div class="rdr-gls-meta">${lang === "zh" ? "首次出现：" : "First occurrence: "}<a href="${escAttr(firstHref)}">${chapterLabel(first)}</a></div>`
      : "";
    const sentence = first?.sentence ? `<p class="rdr-gls-explain">${esc(first.sentence)}</p>` : "";
    return `<li class="rdr-gls-entry" id="gls-${e.key}"><div><span class="rdr-gls-term">${lead}</span> <span class="rdr-gls-alt">${trail}</span></div>${firstMeta}${sentence}</li>`;
  });
  return `<ul class="rdr-gls-list">${items.join("\n")}</ul>`;
}
