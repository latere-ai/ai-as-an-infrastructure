// markdown-it inline plugin for citation, cross-reference, and glossary syntax,
// resolved against the bib +
// crossref map. Handles bracketed citations [@a; @b] / [-@a], bare in-text
// citations @key, and cross-refs @sec-x / @fig-x. Runs as an inline rule so it
// never touches code spans (those are tokenized earlier).

import type MarkdownIt from "markdown-it";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";
import { renderCite, type Bibliography } from "./citations.ts";
import { relHref, type CrossrefMap } from "./crossref.ts";
import { renderGloss, type Glossary } from "./glossary.ts";
import type { Lang } from "../types.ts";

export interface RefContext {
  bib: Bibliography;
  xref: CrossrefMap;
  currentHref: string;
  prefix: string;
  lang: Lang;
  glossary: Glossary;
  glossarySeen: Set<string>;
  glossaryUsed: Set<string>;
}

const KEY = /^[A-Za-z][\w:.-]*/;

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
