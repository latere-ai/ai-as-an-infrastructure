// Build-time rewrites of a Graphviz DOT source before layout. A small lexer
// keeps quoted strings, HTML-like labels, and comments intact, so an attribute
// rewrite never touches label text.
//
// Every layout gets the same base: one layout font, a transparent background,
// a roomier node margin, and no `size` or `ratio` (the reader scales a diagram
// itself, with a minimum text size; `size` shrank text without limit). The
// narrow-layout options below produce the alternative layouts the reader shows
// in a phone-width column: wrapped labels, tighter spacing, a flipped rank
// direction, and dropped `rank=same` pairs.

// Graphviz in wasm has no font files; it sizes text from built-in metric
// tables for a handful of families and falls back to Times for any other name.
// Of those families Verdana is the closest that is never narrower than Inter,
// the UI font the reader renders diagram text in: measured over the book's
// diagram labels in Chrome, Inter runs 4 to 6 percent narrower than Verdana's
// estimate for Latin text and 5 percent narrower for CJK, where Helvetica's
// estimate is 7 percent (Latin) and 20 percent (CJK) too narrow.
export const LAYOUT_FONT = "Verdana";

// Graphviz's default node margin (0.11,0.055 in) crowds multi-line labels
// against rounded and filled box borders; `fixedsize` nodes ignore it.
const NODE_MARGIN = "0.2,0.12";
const TIGHT_NODE_MARGIN = "0.12,0.08";
const TIGHT_NODESEP = 0.15;
// Graphviz's default minimum node width (0.75 in) pads short labels, and some
// sources set wide minimums to make boxes uniform; a tight layout lets boxes
// shrink toward their label (not in a graph with fixed-size nodes, whose
// labels depend on the width they were given).
const TIGHT_MIN_WIDTH = 0.4;
const TIGHT_MAX_WIDTH = 1.2;

export interface LayoutOptions {
  flip?: boolean; // swap the rank axis (TB <-> LR, BT <-> RL)
  wrapEm?: number; // wrap label lines longer than this many em
  tight?: boolean; // smaller node margin and node separation
  unrank?: boolean; // drop rank=same constraints
  // Put graph and cluster labels on the opposite edge, for a layout that is
  // then mirrored top to bottom (diagram-geometry.ts) so they land back.
  invertLabels?: boolean;
}

type TokKind = "id" | "str" | "html" | "punct" | "space" | "comment";
interface Tok { kind: TokKind; text: string }

const ID_START = /[A-Za-z_\u0080-\uffff]/;
const ID_PART = /[A-Za-z0-9_\u0080-\uffff]/;

export function lexDot(src: string): Tok[] {
  const out: Tok[] = [];
  const n = src.length;
  let i = 0;
  while (i < n) {
    const c = src[i];
    const next = src[i + 1];
    let j = i + 1;
    let kind: TokKind;
    if (/\s/.test(c)) {
      while (j < n && /\s/.test(src[j])) j++;
      kind = "space";
    } else if (c === "/" && next === "/") {
      j = src.indexOf("\n", i);
      if (j < 0) j = n;
      kind = "comment";
    } else if (c === "/" && next === "*") {
      j = src.indexOf("*/", i + 2);
      j = j < 0 ? n : j + 2;
      kind = "comment";
    } else if (c === "#" && (i === 0 || src[i - 1] === "\n")) {
      j = src.indexOf("\n", i);
      if (j < 0) j = n;
      kind = "comment";
    } else if (c === '"') {
      while (j < n && src[j] !== '"') j += src[j] === "\\" ? 2 : 1;
      j = Math.min(n, j + 1);
      kind = "str";
    } else if (c === "<") {
      let depth = 1;
      while (j < n && depth > 0) {
        if (src[j] === "<") depth++;
        else if (src[j] === ">") depth--;
        j++;
      }
      kind = "html";
    } else if (c === "-" && (next === ">" || next === "-")) {
      j = i + 2;
      kind = "punct";
    } else if (/[0-9.]/.test(c) || (c === "-" && /[0-9.]/.test(next ?? ""))) {
      while (j < n && /[0-9.]/.test(src[j])) j++;
      kind = "id";
    } else if (ID_START.test(c)) {
      while (j < n && ID_PART.test(src[j])) j++;
      kind = "id";
    } else {
      kind = "punct";
    }
    out.push({ kind, text: src.slice(i, j) });
    i = j;
  }
  return out;
}

// Rewrite `name = value` pairs. The callback returns a replacement value text,
// null to delete the pair (with a trailing `,` or `;`), or undefined to keep it.
function rewriteAttrs(toks: Tok[], fn: (name: string, value: Tok) => string | null | undefined): Tok[] {
  const out: Tok[] = [];
  const skip = (k: number) => { while (k < toks.length && (toks[k].kind === "space" || toks[k].kind === "comment")) k++; return k; };
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind !== "id") { out.push(t); continue; }
    const eq = skip(i + 1);
    if (toks[eq]?.text !== "=") { out.push(t); continue; }
    const v = skip(eq + 1);
    const value = toks[v];
    if (!value || !(value.kind === "id" || value.kind === "str" || value.kind === "html")) { out.push(t); continue; }
    const res = fn(t.text, value);
    if (res === undefined) { out.push(t); continue; }
    if (res === null) {
      const sep = skip(v + 1);
      i = toks[sep]?.text === "," || toks[sep]?.text === ";" ? sep : v;
      continue;
    }
    out.push({ kind: "id", text: t.text }, { kind: "punct", text: "=" }, { kind: value.kind === "html" ? "str" : value.kind, text: res });
    i = v;
  }
  return out;
}

const unquote = (v: Tok) => (v.kind === "str" ? v.text.slice(1, -1) : v.text);
const FLIP: Record<string, string> = { TB: "LR", LR: "TB", BT: "RL", RL: "BT" };

// Em width of a character for wrapping decisions: CJK glyphs are one em, Latin
// text averages a little over half an em in Verdana.
const CJK = /[\u2e80-\u9fff\uf900-\ufaff\uff00-\uffef\u3000-\u303f]/;
const emOf = (ch: string) => (CJK.test(ch) ? 1 : ch === " " ? 0.35 : /[A-Z]/.test(ch) ? 0.68 : 0.58);
const NO_BREAK_BEFORE = /[，。、；：？！）」』》〉,.;:?!)\]]/;
const NO_BREAK_AFTER = /[（「『《〈(\[]/;

// Split one label line (DOT-escaped text, no line breaks) into units that may
// not be broken: Latin words with their trailing space, and single CJK glyphs
// with any punctuation that must stay attached. A one-character Latin word or
// symbol ("+", "y", "·") stays with the word before it, so no line holds it
// alone.
function breakUnits(line: string): string[] {
  const units: string[] = [];
  let cur = "";
  const chars: string[] = [];
  for (let k = 0; k < line.length; k++) {
    if (line[k] === "\\" && k + 1 < line.length) { chars.push(line.slice(k, k + 2)); k++; } else chars.push(line[k]);
  }
  for (let k = 0; k < chars.length; k++) {
    const ch = chars[k];
    const nxt = chars[k + 1] ?? "";
    cur += ch;
    const breakHere =
      ch === " " ||
      (CJK.test(ch) && !NO_BREAK_AFTER.test(ch) && nxt !== "" && !NO_BREAK_BEFORE.test(nxt) && (CJK.test(nxt) || nxt === " ")) ||
      (!CJK.test(ch) && ch !== " " && CJK.test(nxt) && !NO_BREAK_BEFORE.test(nxt));
    if (breakHere) { units.push(cur); cur = ""; }
  }
  if (cur) units.push(cur);
  const glued: string[] = [];
  for (const u of units) {
    const t = u.trim();
    if (glued.length && t.length === 1 && !CJK.test(t)) glued[glued.length - 1] += u;
    else if (glued.length === 1 && glued[0].trim().length === 1 && !CJK.test(glued[0].trim())) glued[0] += u;
    else glued.push(u);
  }
  return glued;
}

const widthEm = (s: string) => [...s.replace(/\\(.)/g, "$1")].reduce((a, ch) => a + emOf(ch), 0);

// Wrap one line into the fewest lines of at most maxEm, then balance them:
// among breaks into that many lines, take the one whose longest line is
// shortest, so a label wraps as "change loss / shape" rather than leaving an
// orphan word. A unit longer than maxEm gets a line of its own.
export function wrapLine(line: string, maxEm: number): string[] {
  if (widthEm(line) <= maxEm) return [line];
  const units = breakUnits(line);
  if (units.length < 2) return [line];
  const n = units.length;
  const w = (a: number, b: number) => widthEm(units.slice(a, b).join("").trimEnd());
  // The fewest lines: a greedy fill up to maxEm.
  let lines = 1;
  for (let i = 0, start = 0; i < n; i++) {
    if (i > start && w(start, i + 1) > maxEm) { lines++; start = i; }
  }
  // solve(i, k): the break of units[i..] into k lines with the shortest
  // longest line, as that width and the end of the first line.
  const memo = new Map<string, { cost: number; cut: number }>();
  const solve = (i: number, k: number): { cost: number; cut: number } => {
    if (k === 1) return { cost: w(i, n), cut: n };
    const key = `${i}:${k}`;
    const hit = memo.get(key);
    if (hit) return hit;
    let best = { cost: Infinity, cut: n };
    for (let j = i + 1; j <= n - k + 1; j++) {
      const cost = Math.max(w(i, j), solve(j, k - 1).cost);
      if (cost < best.cost) best = { cost, cut: j };
    }
    memo.set(key, best);
    return best;
  };
  const out: string[] = [];
  for (let i = 0, k = Math.min(lines, n); i < n; k--) {
    const { cut } = solve(i, k);
    out.push(units.slice(i, cut).join("").trimEnd());
    i = cut;
  }
  return out;
}

// Record labels (`{a | b}`), justified lines (\l, \r), and HTML-like labels
// carry structure that a line break would change, so they are left as written.
function wrapLabel(value: string, maxEm: number): string {
  if (/[{}|]/.test(value) || /\\[lr]/.test(value)) return value;
  return value.split("\\n").flatMap((line) => wrapLine(line, maxEm)).join("\\n");
}

// Index just past the root graph's opening brace, skipping leading comments.
function openBrace(toks: Tok[]): number {
  let seenGraph = false;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind === "id" && /^(di)?graph$/i.test(t.text)) seenGraph = true;
    if (t.text === "{") return seenGraph ? i + 1 : -1;
  }
  return -1;
}

export function prepareDot(body: string, opts: LayoutOptions = {}): string {
  let toks = lexDot(body);
  const fixedSize = /\bfixedsize\b/.test(body);
  let hasRankdir = false;
  let hasNodesep = false;
  toks = rewriteAttrs(toks, (name, value) => {
    const v = unquote(value);
    switch (name) {
      case "fontname": return `"${LAYOUT_FONT}"`;
      case "size": case "ratio": return null;
      case "rankdir":
        hasRankdir = true;
        return opts.flip ? FLIP[v.toUpperCase()] ?? v : undefined;
      case "nodesep":
        hasNodesep = true;
        return opts.tight ? String(Math.min(Number(v) || TIGHT_NODESEP, TIGHT_NODESEP)) : undefined;
      case "width":
        return opts.tight && !fixedSize && Number(v) > TIGHT_MAX_WIDTH ? String(TIGHT_MAX_WIDTH) : undefined;
      case "rank": return opts.unrank && v === "same" ? null : undefined;
      case "labelloc": return opts.invertLabels ? ({ t: "b", b: "t" } as Record<string, string>)[v] ?? undefined : undefined;
      case "label":
        return opts.wrapEm && value.kind === "str" ? `"${wrapLabel(v, opts.wrapEm)}"` : undefined;
      default: return undefined;
    }
  });
  const at = openBrace(toks);
  if (at < 0) return body;
  const font = `fontname="${LAYOUT_FONT}"`;
  const node = opts.tight && !fixedSize ? `margin="${TIGHT_NODE_MARGIN}", width=${TIGHT_MIN_WIDTH}` : `margin="${opts.tight ? TIGHT_NODE_MARGIN : NODE_MARGIN}"`;
  let defaults = `\n  graph [${font}, bgcolor="transparent"];\n  node [${font}, ${node}];\n  edge [${font}];`;
  if (opts.flip && !hasRankdir) defaults += `\n  rankdir=LR;`;
  if (opts.tight && !hasNodesep) defaults += `\n  nodesep=${TIGHT_NODESEP};`;
  if (opts.invertLabels) defaults += `\n  labelloc=t;`; // the root's default is b
  const text = toks.map((t) => t.text);
  if (opts.invertLabels) {
    // A cluster's default label location is t; each gets b before its own
    // statements, which may set it again (already inverted above).
    for (let i = toks.length - 1; i > at; i--) {
      if (toks[i].text !== "{") continue;
      const prev = toks.slice(0, i).filter((t) => t.kind !== "space" && t.kind !== "comment");
      const name = prev[prev.length - 1], kw = prev[prev.length - 2];
      if (kw?.text === "subgraph" && /^"?cluster/.test(name?.text ?? "")) text.splice(i + 1, 0, " labelloc=b;");
    }
  }
  text.splice(at, 0, defaults);
  return text.join("");
}
