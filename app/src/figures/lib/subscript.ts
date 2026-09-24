// SVG text with subscripts written in the label as base_sub (r_t, r_out, z_3,
// N_full). The subscript is set smaller and lowered with dy, and the baseline
// is restored for the text after it; dy positions the same way in every
// browser, which baseline-shift does not. Everything else is escaped as text.

import { el, esc, type Attrs } from "./svg.ts";
import { textWidth } from "./labels.ts";

const SUB = /([A-Za-z])_([A-Za-z0-9]+)/g;

export function subText(x: number, y: number, s: string | number, a: Attrs = {}): string {
  const str = String(s);
  const size = Number(a["font-size"] ?? 12);
  const d = Math.round(size * 2.8) / 10;
  const fs = Math.round(size * 0.78);
  let out = "", i = 0, lowered = false;
  for (const m of str.matchAll(SUB)) {
    const pre = str.slice(i, m.index) + m[1];
    out += lowered ? `<tspan dy="${-d}">${esc(pre)}</tspan>` : esc(pre);
    out += `<tspan dy="${d}" font-size="${fs}">${esc(m[2])}</tspan>`;
    lowered = true;
    i = (m.index ?? 0) + m[0].length;
  }
  const rest = str.slice(i);
  if (rest) out += lowered ? `<tspan dy="${-d}">${esc(rest)}</tspan>` : esc(rest);
  return el("text", { x, y, ...a }, out);
}

// Width of a label as subText draws it: subscripts at their smaller size.
export function subWidth(s: string, size: number): number {
  let w = 0, i = 0;
  const str = String(s);
  for (const m of str.matchAll(SUB)) {
    w += textWidth(str.slice(i, m.index) + m[1], size) + textWidth(m[2], size * 0.78);
    i = (m.index ?? 0) + m[0].length;
  }
  return w + textWidth(str.slice(i), size);
}
