// markdown-it inline plugin for citation, cross-reference, and glossary syntax,
// resolved against the bib +
// crossref map. Handles bracketed citations [@a; @b] / [-@a], bare in-text
// citations @key, and cross-refs @sec-x / @fig-x. Runs as an inline rule so it
// never touches code spans (those are tokenized earlier).

import type MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import { renderCite, type Bibliography } from "./citations.ts";
import { relHref, type CrossrefMap } from "./crossref.ts";
import { renderGloss, renderGlossText, type Glossary, type GlossFirstUseMap } from "./glossary.ts";
import type { Lang } from "../types.ts";

export interface RefContext {
  bib: Bibliography;
  xref: CrossrefMap;
  currentHref: string;
  chapterTitle: string;
  chapterNum: string;
  prefix: string;
  lang: Lang;
  glossary: Glossary;
  glossarySeen: Set<string>;
  glossaryUsed: Set<string>;
  glossaryFirstUses: GlossFirstUseMap;
}

const KEY = /^[A-Za-z][\w:.-]*/;
const SENTENCE_END = new Set([".", "!", "?", "。", "！", "？"]);

function isSentenceEnd(src: string, pos: number): boolean {
  if (!SENTENCE_END.has(src[pos])) return false;
  if (src[pos] !== ".") return true;
  if (/\d\.\d/.test(src.slice(Math.max(0, pos - 1), pos + 2))) return false;
  const before = src.slice(Math.max(0, pos - 16), pos + 1).toLowerCase();
  if (/(^|\s)(et\s+al|e\.g|i\.e|vs|etc)\.$/.test(before)) return false;
  return true;
}

function canStartSentenceAfter(src: string, pos: number): boolean {
  return /[。！？]/.test(src[pos]) || pos + 1 === src.length || /\s/.test(src[pos + 1]);
}

function sentenceAround(src: string, markerStart: number, markerLen: number, ctx: RefContext): string {
  let begin = 0;
  for (let i = markerStart - 1; i >= 0; i--) {
    if (isSentenceEnd(src, i) && canStartSentenceAfter(src, i)) {
      begin = i + 1;
      break;
    }
  }

  let end = src.length;
  for (let i = markerStart + markerLen; i < src.length; i++) {
    if (isSentenceEnd(src, i)) {
      end = i + 1;
      break;
    }
  }

  return src
    .slice(begin, end)
    .trim()
    .replace(/@gls-([A-Za-z][\w:.-]*)/g, (m, rawKey: string) => {
      const gkey = rawKey.replace(/[.,;:]+$/, "");
      const trailing = rawKey.slice(gkey.length);
      const entry = ctx.glossary.get(gkey);
      return entry ? `${renderGlossText(entry, ctx.lang, true)}${trailing}` : m;
    })
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\[@[^\]]+\]/g, "")
    .replace(/@(sec|fig)-([A-Za-z][\w:.-]*)/g, (m, kind: string, rawKey: string) => {
      const suffix = rawKey.replace(/[.,;:]+$/, "");
      const trailing = rawKey.slice(suffix.length);
      const target = ctx.xref.get(`${kind}-${suffix}`);
      return target ? `${target.label}${trailing}` : m;
    })
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/\*\*|__/g, "")
    .replace(/\\([()[\]{}*_`])/g, "$1")
    .replace(/\s+([,.;:!?，。！？；：])/g, "$1")
    .replace(/([（(])\s+/g, "$1")
    .replace(/\s+([）)])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

export function inlineRefs(md: MarkdownIt, ctx: RefContext) {
  const push = (state: StateInline, html: string) => {
    const tok = state.push("html_inline", "", 0);
    tok.content = html;
  };

  function rule(state: StateInline, silent: boolean): boolean {
    const src = state.src;
    const start = state.pos;
    const ch = src.charCodeAt(start);

    // Bracketed citation: [@key], [@a; @b], [-@key]
    if (ch === 0x5b /* [ */ && (src[start + 1] === "@" || (src[start + 1] === "-" && src[start + 2] === "@"))) {
      const end = src.indexOf("]", start);
      if (end === -1) return false;
      const inner = src.slice(start + 1, end);
      // every segment must look like (-)@key
      const segs = inner.split(";").map((s) => s.trim());
      if (!segs.every((s) => /^-?@[A-Za-z][\w:.-]*$/.test(s))) return false;
      if (!silent) {
        const keys = segs.map((s) => s.replace(/^-?@/, ""));
        push(state, renderCite(ctx.bib, { keys, bare: false }, ctx.prefix));
      }
      state.pos = end + 1;
      return true;
    }

    // Bare @key (citation or cross-ref). Must not follow an alphanumeric (emails).
    if (ch === 0x40 /* @ */) {
      const prev = start > 0 ? src.charCodeAt(start - 1) : 0x20;
      const isAlnum = (c: number) => (c >= 48 && c <= 57) || (c >= 65 && c <= 90) || (c >= 97 && c <= 122);
      if (isAlnum(prev)) return false;
      const m = KEY.exec(src.slice(start + 1));
      if (!m) return false;
      const key = m[0].replace(/[.,;:]+$/, ""); // don't swallow trailing punctuation
      if (!silent) {
        if (key.startsWith("sec-") || key.startsWith("fig-")) {
          const target = ctx.xref.get(key);
          if (target) push(state, `<a href="${relHref(target, ctx.currentHref, ctx.prefix)}" class="rdr-xref">${target.label}</a>`);
          else push(state, `<span class="rdr-xref rdr-xref-missing">?@${key}</span>`);
        } else if (key.startsWith("gls-")) {
          const gkey = key.slice(4);
          const entry = ctx.glossary.get(gkey);
          if (entry) {
            if (!ctx.glossaryFirstUses.has(gkey)) {
              ctx.glossaryFirstUses.set(gkey, {
                key: gkey,
                href: ctx.currentHref,
                title: ctx.chapterTitle,
                chapterNum: ctx.chapterNum,
                sentence: sentenceAround(src, start, 1 + key.length, ctx),
              });
            }
            const first = !ctx.glossarySeen.has(gkey);
            ctx.glossarySeen.add(gkey);
            ctx.glossaryUsed.add(gkey);
            push(state, renderGloss(entry, ctx.lang, first, ctx.prefix));
          } else {
            push(state, `<span class="rdr-gls rdr-gls-missing">?gls-${gkey}</span>`);
          }
        } else {
          push(state, renderCite(ctx.bib, { keys: [key], bare: true }, ctx.prefix));
        }
      }
      state.pos = start + 1 + key.length;
      return true;
    }

    return false;
  }

  md.inline.ruler.before("link", "inline_refs", rule);
}
