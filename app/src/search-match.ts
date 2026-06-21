// Client-side search matcher: a pure, DOM-free scorer the spotlight modal runs
// over the lazily-loaded search.json. Kept separate from Reader.tsx so it can be
// unit-tested. The index itself is built in pipeline/search.ts.
//
// Matching is multi-word AND: the query is split on whitespace and every token
// must hit somewhere in a doc (a pure-hanzi query has no spaces, so it stays one
// token and still matches by substring). Per token, an exact substring scores by
// field weight; docs that match more tokens exactly always outrank fuzzier ones.

export interface SearchDoc {
  href: string;
  anchor: string;
  num: string;
  title: string;
  heading: string;
  text: string;
}

export interface Snip { pre: string; hit: string; post: string }
export interface Scored { doc: SearchDoc; score: number; snip: Snip }

// Field weights for an exact substring hit.
const W_TITLE = 4;
const W_HEADING = 2;
const W_TEXT = 1;

// A snippet of body text centred on the first query hit, split so the match can
// be wrapped in <mark> as a React node (the body contains literal <, >, & from
// code/math, so string-injecting HTML is unsafe).
export function snippet(text: string, token: string): Snip {
  const idx = token ? text.toLowerCase().indexOf(token) : -1;
  if (idx < 0) return { pre: text.slice(0, 140), hit: "", post: "" };
  const start = Math.max(0, idx - 48);
  const end = Math.min(text.length, idx + token.length + 96);
  return {
    pre: (start > 0 ? "… " : "") + text.slice(start, idx),
    hit: text.slice(idx, idx + token.length),
    post: text.slice(idx + token.length, end) + (end < text.length ? " …" : ""),
  };
}

export function runSearch(docs: SearchDoc[], rawQuery: string, limit = 12): Scored[] {
  const query = rawQuery.trim().toLowerCase();
  if (!query) return [];
  const tokens = query.split(/\s+/).filter(Boolean);
  if (!tokens.length) return [];

  const scored: { doc: SearchDoc; exact: number; score: number; snipToken: string }[] = [];
  for (const d of docs) {
    const title = d.title.toLowerCase();
    const heading = d.heading.toLowerCase();
    const text = d.text.toLowerCase();
    let total = 0;
    let exact = 0;
    let snipToken = "";
    let ok = true;
    for (const tok of tokens) {
      const inTitle = title.includes(tok);
      const inHeading = heading.includes(tok);
      const inText = text.includes(tok);
      if (!inTitle && !inHeading && !inText) { ok = false; break; }
      exact += 1;
      total += (inTitle ? W_TITLE : 0) + (inHeading ? W_HEADING : 0) + (inText ? W_TEXT : 0);
      if (!snipToken && inText) snipToken = tok;
    }
    if (!ok) continue;
    if (!snipToken) snipToken = tokens[0];
    scored.push({ doc: d, exact, score: total, snipToken });
  }

  // More exact-token hits first, then raw field score: an exact match can never
  // be displaced by a fuzzier one (matters once fuzzy tiers are added).
  scored.sort((a, b) => b.exact - a.exact || b.score - a.score);

  // Cap sections per chapter so one long chapter cannot fill the whole list.
  const perChapter: Record<string, number> = {};
  const out: Scored[] = [];
  for (const r of scored) {
    const n = perChapter[r.doc.href] ?? 0;
    if (n >= 2) continue;
    perChapter[r.doc.href] = n + 1;
    out.push({ doc: r.doc, score: r.score, snip: snippet(r.doc.text, r.snipToken) });
    if (out.length >= limit) break;
  }
  return out;
}
