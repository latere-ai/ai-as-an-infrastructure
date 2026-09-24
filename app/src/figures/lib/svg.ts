// A small string builder for SVG. Figures render to markup strings so the same
// code runs at build time and in the browser. Colors are passed as CSS values
// (usually theme tokens from theme.ts) and emitted in a style attribute, so a
// var(--fig-...) reference resolves against the page theme in both the static
// fallback and the live figure.

export type Attrs = Record<string, string | number | boolean | null | undefined>;

// Color properties are emitted as CSS in `style` rather than as presentation
// attributes, so that a var() token resolves in every browser.
const STYLE_PROPS = new Set(["fill", "stroke"]);

export function esc(s: string | number): string {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Round coordinates so markup stays compact and stable across platforms.
export function r(n: number): number {
  return Math.round(n * 10) / 10;
}

function attrString(a: Attrs): string {
  let out = "";
  let style = "";
  for (const [k, v] of Object.entries(a)) {
    if (v == null || v === false) continue;
    if (STYLE_PROPS.has(k)) style += `${k}:${v};`;
    else if (v === true) out += ` ${k}`;
    else out += ` ${k}="${typeof v === "number" ? r(v) : esc(v)}"`;
  }
  return style ? `${out} style="${esc(style)}"` : out;
}

// el("rect", { x: 1, fill: C.c1 }) or el("g", {}, child1, child2)
export function el(tag: string, a: Attrs = {}, ...children: Array<string | false | null | undefined>): string {
  const inner = children.filter(Boolean).join("");
  return inner || !SELF_CLOSING.has(tag) ? `<${tag}${attrString(a)}>${inner}</${tag}>` : `<${tag}${attrString(a)}/>`;
}
const SELF_CLOSING = new Set(["rect", "circle", "line", "path", "polyline", "polygon", "ellipse", "use", "stop"]);

// Text node. Pass `class` to pick a typographic role from theme.css
// (fig-t-strong, fig-t-muted, fig-t-num); size and color default from CSS.
// A one-letter symbol written as base_sub (T_msg, p_G, n_kv, g_i) is set with
// a lowered, smaller subscript, so readouts show notation instead of raw
// underscores. The base must stand alone (no letter or digit before it), which
// leaves identifiers such as edit_file untouched. dy positions the subscript
// the same way in every browser; the baseline is restored after it.
const SUBSCRIPT = /(?<![A-Za-z0-9])([A-Za-z])_([A-Za-z0-9\u03b1-\u03c9]+)/g;

export function text(x: number, y: number, s: string | number, a: Attrs = {}): string {
  const str = String(s);
  if (!str.includes("_")) return el("text", { x, y, ...a }, esc(str));
  const size = Number(a["font-size"] ?? 12);
  const d = Math.round(size * 2.8) / 10;
  const fs = Math.round(size * 0.78);
  let out = "", i = 0, shifted = 0;
  for (const m of str.matchAll(SUBSCRIPT)) {
    const pre = str.slice(i, m.index) + m[1];
    out += shifted ? `<tspan dy="${-shifted}">${esc(pre)}</tspan>` : esc(pre);
    out += `<tspan dy="${d}" font-size="${fs}">${esc(m[2])}</tspan>`;
    shifted = d;
    i = (m.index ?? 0) + m[0].length;
  }
  const rest = str.slice(i);
  if (rest) out += shifted ? `<tspan dy="${-shifted}">${esc(rest)}</tspan>` : esc(rest);
  return el("text", { x, y, ...a }, out);
}

export function g(a: Attrs, ...children: Array<string | false | null | undefined>): string {
  return el("g", a, ...children);
}

// The root element. viewBox only, no width attribute: the stylesheet makes the
// SVG fill its column, so there is never a fixed width wider than the column.
export function svg(w: number, h: number, label: string, ...children: Array<string | false | null | undefined>): string {
  return `<svg class="fig-svg" viewBox="0 0 ${r(w)} ${r(h)}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg">${children.filter(Boolean).join("")}</svg>`;
}

// A path from points.
export function linePath(pts: Array<[number, number]>): string {
  return pts.map(([x, y], i) => `${i ? "L" : "M"}${r(x)},${r(y)}`).join("");
}

// Diagonal hatch pattern definition, for "reserved" or "masked" regions.
export function hatch(id: string, color: string, gap = 5, width = 1.2): string {
  return el("pattern", { id, width: gap, height: gap, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" },
    el("line", { x1: 0, y1: 0, x2: 0, y2: gap, stroke: color, "stroke-width": width }));
}
