// SVG text for the notation figure labels use: subscripts written as base_sub
// (r_t, r_out, z_3, N_full) and a circumflex written as a letter followed by
// U+0302 (v̂).
//
// - A subscript is set smaller and lowered with dy, and the baseline is
//   restored for the text after it; dy positions the same way in every
//   browser, which baseline-shift does not.
// - The web font's Latin subset has no combining circumflex, so v̂ would take
//   its mark from a fallback font and print it beside the letter. The letter is
//   drawn plainly and the spacing circumflex U+02C6, which the subset has, is
//   pulled back over it with dx (Inter: v is 0.56 em, the circumflex 0.41 em)
//   and the pen is returned to the letter's end.
// Everything else is escaped as text.

import { el, esc, type Attrs } from "./svg.ts";
import { textWidth } from "./labels.ts";

const TOKEN = /([A-Za-z])̂|([A-Za-z])_([A-Za-z0-9]+)/g;

export function mathText(x: number, y: number, s: string | number, a: Attrs = {}): string {
  const str = String(s);
  const size = Number(a["font-size"] ?? 12);
  const d = Math.round(size * 2.8) / 10;
  const fs = Math.round(size * 0.78);
  let out = "", i = 0, shifted = 0, dx = "";
  // Plain text, undoing a pending subscript drop or circumflex pull-back.
  const emit = (t: string) => {
    if (!t) return;
    out += shifted || dx ? `<tspan${dx ? ` dx="${dx}"` : ""}${shifted ? ` dy="${-shifted}"` : ""}>${esc(t)}</tspan>` : esc(t);
    shifted = 0;
    dx = "";
  };
  for (const m of str.matchAll(TOKEN)) {
    const pre = str.slice(i, m.index);
    if (m[1]) {
      emit(pre + m[1]);
      out += `<tspan dx="-0.5em">\u02c6</tspan>`;
      dx = "0.09em";
    } else {
      emit(pre + m[2]);
      out += `<tspan dy="${d}" font-size="${fs}">${esc(m[3])}</tspan>`;
      shifted = d;
    }
    i = (m.index ?? 0) + m[0].length;
  }
  emit(str.slice(i));
  return el("text", { x, y, ...a }, out);
}

// Width of a label as mathText draws it.
export function mathWidth(s: string, size: number): number {
  let w = 0, i = 0;
  const str = String(s);
  for (const m of str.matchAll(TOKEN)) {
    w += textWidth(str.slice(i, m.index), size);
    w += m[1] ? textWidth(m[1], size) : textWidth(m[2], size) + textWidth(m[3], size * 0.78);
    i = (m.index ?? 0) + m[0].length;
  }
  return w + textWidth(str.slice(i), size);
}
