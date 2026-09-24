// What the search dialog shows before the reader types: the pages they read
// most recently, or a fixed set of starting pages on a first visit, and a row
// of suggested topics that fill the query. Pure except for the two storage
// helpers, which tolerate a missing or blocked localStorage.

import type { SearchDoc } from "./search-match.ts";

type Lang = "en" | "zh";

// Topics a reader is likely to look up, in each book's own vocabulary. Every
// term must occur in that language's chapters (search-suggest.test.ts).
export const SUGGESTED: Record<Lang, string[]> = {
  en: ["KV cache", "speculative decoding", "scaling laws", "mixture-of-experts", "RLHF", "quantization", "sandbox", "MCP"],
  zh: ["KV 缓存", "推测解码", "扩展律", "混合专家", "RLHF", "量化", "沙箱", "MCP"],
};

// Starting pages for a reader with no history. "field/" stands for the newest
// State of the Field issue, whose href carries its month.
export const START = ["index", "orientation/field-map", "field/", "glossary"];

export const RECENT_MAX = 5;
const recentKey = (lang: Lang) => `aaai-recent-${lang}`;

export function readRecent(lang: Lang): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(recentKey(lang)) ?? "[]");
    return Array.isArray(v) ? v.filter((h): h is string => typeof h === "string") : [];
  } catch {
    return [];
  }
}

export function pushRecent(lang: Lang, href: string): void {
  try {
    const next = [href, ...readRecent(lang).filter((h) => h !== href)].slice(0, RECENT_MAX);
    localStorage.setItem(recentKey(lang), JSON.stringify(next));
  } catch {
    // Storage blocked: the dialog falls back to the starting pages.
  }
}

// Page-level docs (no anchor) for the empty dialog: recent pages other than
// the one open, else the starting pages. Hrefs the index no longer has are
// dropped, so a renamed chapter never shows a dead entry.
export function emptyStateDocs(docs: SearchDoc[], recent: string[], current: string): { kind: "recent" | "start"; docs: SearchDoc[] } {
  const pages = new Map(docs.filter((d) => !d.anchor).map((d) => [d.href, d]));
  const seen = recent.filter((h) => h !== current).map((h) => pages.get(h)).filter((d): d is SearchDoc => !!d);
  if (seen.length) return { kind: "recent", docs: seen };
  const newestField = [...pages.keys()].filter((h) => h.startsWith("field/")).sort().pop();
  const start = START.map((h) => pages.get(h === "field/" ? newestField ?? "" : h)).filter((d): d is SearchDoc => !!d && d.href !== current);
  return { kind: "start", docs: start };
}
