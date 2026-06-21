// Cross-reference map: scan every chapter for section labels ({#sec-} on H1)
// and figure labels ({#fig-} on images + ```{mermaid}/{dot} //| label: }) to
// assign book-wide numbers, so @sec-x → "Chapter N" and @fig-x → "Figure C.N",
// each linking to the owning chapter page + anchor.

import { readFileSync } from "node:fs";
import type { Book } from "./book.ts";

export interface RefTarget {
  kind: "sec" | "fig";
  label: string; // "Chapter 6" or "Figure 6.1"
  href: string; // "p1-.../06-x.html#sec-..."
}

export type CrossrefMap = Map<string, RefTarget>;

export function buildCrossref(book: Book): CrossrefMap {
  const map: CrossrefMap = new Map();
  const secWord = book.lang === "zh" ? "第 %s 章" : "Chapter %s";
  const figWord = book.lang === "zh" ? "图 %s" : "Figure %s";

  for (const ch of book.chapters) {
    const text = readFileSync(ch.qmdPath, "utf8");

    // Section: the H1 {#sec-...} owns the chapter.
    const h1 = text.split("\n").find((l) => l.trim().startsWith("# "));
    const secId = h1?.match(/\{#(sec-[a-z0-9-]+)/)?.[1];
    if (secId) {
      map.set(secId, {
        kind: "sec",
        label: ch.num ? secWord.replace("%s", ch.num) : ch.title,
        href: `${ch.href}#${secId}`,
      });
    }

    // Figures: images ![..](..){#fig-x} and diagram blocks //| or %%| label: fig-x
    // numbered by order of appearance within the chapter.
    let figN = 0;
    const figRe = /\{#(fig-[a-z0-9-]+)|(?:\/\/\||%%\|)\s*label:\s*(fig-[a-z0-9-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = figRe.exec(text))) {
      const figId = m[1] ?? m[2];
      if (!figId || map.has(figId)) continue;
      figN++;
      const numLabel = ch.num ? `${ch.num}.${figN}` : String(figN);
      map.set(figId, {
        kind: "fig",
        label: figWord.replace("%s", numLabel),
        href: `${ch.href}#${figId}`,
      });
    }
  }
  return map;
}

// Make a target's href relative to the chapter currently being rendered: links
// within the same chapter become bare "#anchor"; cross-page links get the
// page's depth prefix so the lang-root-relative path resolves correctly.
export function relHref(target: RefTarget, currentHref: string, prefix = ""): string {
  const [path] = target.href.split("#");
  if (path === currentHref) return target.href.slice(path.length); // "#anchor"
  return prefix + target.href;
}

// Resolve bare @sec-x / @fig-x cross-refs inside a plain-text fragment that does
// not pass through the markdown-it inline pipeline (figure captions, Further-
// reading glosses). Mirrors the cross-ref branch of the quarto_refs inline rule.
// Escaping-neutral: it only rewrites ref tokens and leaves all other characters
// byte-identical, so callers control escaping (pass already-escaped text in).
// The leading (^|[^A-Za-z0-9]) guard keeps it from firing inside words or emails.
export function resolveXrefsInText(text: string, xref: CrossrefMap, currentHref: string, prefix = ""): string {
  return text.replace(/(^|[^A-Za-z0-9])@((?:sec|fig)-[a-z0-9-]+)/g, (_full, pre: string, key: string) => {
    const target = xref.get(key);
    if (target) return `${pre}<a href="${relHref(target, currentHref, prefix)}" class="rdr-xref">${target.label}</a>`;
    return `${pre}<span class="rdr-xref rdr-xref-missing">?@${key}</span>`;
  });
}
