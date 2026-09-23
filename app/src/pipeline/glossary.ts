// Glossary engine: a \ref-style mechanism for professional terms. Authors write
// @gls-<key> in the .qmd; the inline-ref rule resolves it against
// glossary.yml. First use in a chapter expands to the full term plus its English
// original in parens (e.g. 混合专家（MoE） / mixture-of-experts (MoE)); later uses
// in the same chapter show the short form. Every use links to the auto-generated
// glossary page. Terms are defined once in glossary.yml, never maintained by hand
// in the prose.

import { parse as parseYaml } from "yaml";
import { readFileSync, existsSync } from "node:fs";
import type { Heading, Lang } from "../types.ts";
import { formatMonth } from "./dates.ts";

// How settled a technique is, in the order the Techniques index lists them.
export const TECHNIQUE_STATUSES = ["emerging", "adopted", "established", "faded"] as const;
export type TechniqueStatus = (typeof TECHNIQUE_STATUSES)[number];

export interface GlossEntry {
  key: string;
  en: string; // full English term, e.g. "mixture-of-experts"
  zh: string; // full Chinese term, e.g. "混合专家"
  abbr?: string; // language-neutral abbreviation, e.g. "MoE"
  defEn?: string; // one-line definition, English
  defZh?: string; // one-line definition, Chinese
  // Technique fields. An entry with a status is listed in the Techniques index.
  status?: TechniqueStatus;
  added?: string; // YYYY-MM the entry was added
  section?: string; // sec- id of the chapter that explains it; "" = not yet in a chapter
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
    const def = v.def && typeof v.def === "object" ? v.def : null;
    const status = v.status != null ? String(v.status) : undefined;
    const known = (TECHNIQUE_STATUSES as readonly string[]).includes(status ?? "");
    if (status && !known) console.warn(`  glossary: ${key} has unknown status "${status}" (${TECHNIQUE_STATUSES.join(", ")})`);
    m.set(key, {
      key,
      en: String(v.en ?? ""),
      zh: String(v.zh ?? ""),
      abbr: v.abbr != null ? String(v.abbr) : undefined,
      defEn: def?.en != null ? String(def.en) : undefined,
      defZh: def?.zh != null ? String(def.zh) : undefined,
      status: known ? (status as TechniqueStatus) : undefined,
      added: v.added != null ? String(v.added) : undefined,
      section: v.section != null ? String(v.section).replace(/^@/, "") : undefined,
    });
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

// A first-use sentence earns its place on the glossary page only if it actually
// explains the term. The prose pattern "... This is **@gls-prefill**." extracts
// to "This is prefill.", which is a dead end; require a sentence with real
// content (en: at least six words; zh: at least fourteen characters).
function isSubstantive(sentence: string, lang: Lang): boolean {
  return lang === "zh" ? sentence.length >= 14 : sentence.trim().split(/\s+/).length >= 6;
}

// The glossary page body: every used term, sorted, each with a {#gls-key} anchor.
// On the zh page the Chinese term leads; on en, the English leads.
export function renderGlossaryPage(gloss: Glossary, used: Set<string>, firstUses: GlossFirstUseMap, lang: Lang): string {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escAttr = (s: string) => esc(s).replace(/"/g, "&quot;");
  const chapterLabel = (u: GlossFirstUse) =>
    u.chapterNum ? `${lang === "zh" ? `第 ${u.chapterNum} 章` : `Chapter ${u.chapterNum}`} · ${esc(u.title)}` : esc(u.title);
  const entries = [...used].map((k) => gloss.get(k)).filter((e): e is GlossEntry => !!e);
  // Order the page by where a reader meets each term, not alphabetically: the
  // book compiles in order and firstUses records each term at first sighting, so
  // its insertion order is exactly chapter-then-occurrence. Terms with no
  // recorded first use sort last, alphabetically, as a stable fallback.
  const occurrence = new Map<string, number>();
  for (const k of firstUses.keys()) occurrence.set(k, occurrence.size);
  const rank = (k: string) => (occurrence.has(k) ? occurrence.get(k)! : Number.MAX_SAFE_INTEGER);
  entries.sort((a, b) => rank(a.key) - rank(b.key) || (lang === "zh" ? a.zh.localeCompare(b.zh, "zh") : a.en.localeCompare(b.en)));
  const items = entries.map((e) => {
    const enLabel = e.abbr && e.abbr !== e.en ? `${esc(e.en)} (${esc(e.abbr)})` : esc(e.en);
    const lead = lang === "zh" ? esc(e.zh) : enLabel;
    const trail = lang === "zh" ? enLabel : esc(e.zh);
    const first = firstUses.get(e.key);
    const firstHref = first ? (first.href === "index" ? "./" : first.href) : "";
    const firstMeta = first
      ? `<div class="rdr-gls-meta">${lang === "zh" ? "首次出现：" : "First occurrence: "}<a href="${escAttr(firstHref)}">${chapterLabel(first)}</a></div>`
      : "";
    // A curated one-line definition wins. Otherwise fall back to the first-use
    // sentence, but only when it is substantive: a sentence like "This is
    // prefill." teaches nothing, so suppress the degenerate short ones.
    const def = lang === "zh" ? e.defZh : e.defEn;
    const explain = def || (first?.sentence && isSubstantive(first.sentence, lang) ? first.sentence : "");
    const sentence = explain ? `<p class="rdr-gls-explain">${esc(explain)}</p>` : "";
    return `<li class="rdr-gls-entry" id="gls-${e.key}"><div><span class="rdr-gls-term">${lead}</span> <span class="rdr-gls-alt">${trail}</span></div>${firstMeta}${sentence}</li>`;
  });
  return `<ul class="rdr-gls-list">${items.join("\n")}</ul>`;
}

const STATUS_LABEL: Record<Lang, Record<TechniqueStatus, string>> = {
  en: { emerging: "Emerging", adopted: "Adopted", established: "Established", faded: "Faded" },
  zh: { emerging: "新兴", adopted: "已采用", established: "成熟", faded: "淡出" },
};

const TECHNIQUE_TEXT: Record<Lang, { heading: string; intro: string; coveredIn: string; notYet: string; added: (m: string) => string }> = {
  en: {
    heading: "Techniques",
    intro: "Techniques grouped by how settled they are. Each entry links to the chapter that explains it and gives the month the entry was added. A technique no chapter covers yet is listed as a short note until one does.",
    coveredIn: "Covered in: ",
    notYet: "Not yet in a chapter",
    added: (m) => `Added ${m}`,
  },
  zh: {
    heading: "技术索引",
    intro: "以下技术按成熟程度分组。每个条目链接到讲解它的章节，并注明条目加入的月份。尚无章节讲解的技术先以简短说明列出，待有章节讲解后再补上链接。",
    coveredIn: "讲解章节：",
    notYet: "尚未写入章节",
    added: (m) => `${m}加入`,
  },
};

export type SectionLink = (secId: string) => { href: string; label: string } | null;

// The Techniques index on the glossary page: every entry with a status, grouped
// emerging → adopted → established → faded, newest first within a group. Unlike
// the term list it does not depend on @gls use, so a technique can enter as a
// short note before any chapter covers it. A term that is also in the term list
// links to its entry there. Returns the HTML and the headings for the mini-TOC.
export function renderTechniqueIndex(gloss: Glossary, used: Set<string>, lang: Lang, sectionLink: SectionLink): { html: string; headings: Heading[] } {
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const escAttr = (s: string) => esc(s).replace(/"/g, "&quot;");
  const text = TECHNIQUE_TEXT[lang];
  const techniques = [...gloss.values()].filter((e) => e.status);
  if (!techniques.length) return { html: "", headings: [] };
  const name = (e: GlossEntry) => (lang === "zh" ? e.zh : e.en);
  const headings: Heading[] = [{ id: "techniques", text: text.heading, level: 2 }];
  const groups: string[] = [];
  for (const status of TECHNIQUE_STATUSES) {
    const entries = techniques
      .filter((e) => e.status === status)
      .sort((a, b) => (b.added ?? "").localeCompare(a.added ?? "") || name(a).localeCompare(name(b), lang));
    if (!entries.length) continue;
    const id = `techniques-${status}`;
    headings.push({ id, text: STATUS_LABEL[lang][status], level: 3 });
    const items = entries.map((e) => {
      const enLabel = e.abbr && e.abbr !== e.en ? `${esc(e.en)} (${esc(e.abbr)})` : esc(e.en);
      const lead = lang === "zh" ? esc(e.zh) : enLabel;
      const trail = lang === "zh" ? enLabel : esc(e.zh);
      const term = used.has(e.key)
        ? `<a class="rdr-gls-term" href="#gls-${e.key}">${lead}</a>`
        : `<span class="rdr-gls-term">${lead}</span>`;
      const link = e.section ? sectionLink(e.section) : null;
      if (e.section && !link) console.warn(`  glossary: ${e.key} names unknown section "${e.section}"`);
      const where = link ? `${text.coveredIn}<a href="${escAttr(link.href)}">${esc(link.label)}</a>` : text.notYet;
      const month = e.added ? formatMonth(e.added, lang) : "";
      const meta = `<div class="rdr-gls-meta">${where}${month ? ` · ${text.added(month)}` : ""}</div>`;
      const def = lang === "zh" ? e.defZh : e.defEn;
      const note = def ? `<p class="rdr-gls-explain">${esc(def)}</p>` : "";
      return `<li class="rdr-tech-entry" id="tech-${e.key}"><div>${term} <span class="rdr-gls-alt">${trail}</span></div>${meta}${note}</li>`;
    });
    groups.push(`<h3 id="${id}">${STATUS_LABEL[lang][status]}</h3>\n<ul class="rdr-gls-list">${items.join("\n")}</ul>`);
  }
  const html = `<h2 id="techniques">${text.heading}</h2>\n<p>${text.intro}</p>\n${groups.join("\n")}`;
  return { html, headings };
}
