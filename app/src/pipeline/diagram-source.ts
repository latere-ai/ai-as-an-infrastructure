// Build-time rewrites of a Graphviz DOT source before layout. A small lexer
// keeps quoted strings, HTML-like labels, and comments intact, so an attribute
// rewrite never touches label text.

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

// Every layout gets the same base: one layout font for every label (the
// source's fontname is replaced), a transparent background, and a roomier
// default node margin, injected right after the root graph's opening brace.
export function prepareDot(body: string): string {
  const toks = rewriteAttrs(lexDot(body), (name) => (name === "fontname" ? `"${LAYOUT_FONT}"` : undefined));
  const at = openBrace(toks);
  if (at < 0) return body;
  const font = `fontname="${LAYOUT_FONT}"`;
  const defaults = `\n  graph [${font}, bgcolor="transparent"];\n  node [${font}, margin="${NODE_MARGIN}"];\n  edge [${font}];`;
  const text = toks.map((t) => t.text);
  text.splice(at, 0, defaults);
  return text.join("");
}
