// Symbols with word subscripts as SVG text. Unicode has subscript digits and a
// few letters (C₀, sᵢ) but not whole words, so a label such as C_{fixed} or
// NB_H is set as tspans: "_x" or "_{...}" is a subscript, shifted below the
// baseline and never smaller than the 12 px body size.

import { el, esc, type Attrs } from "./svg.ts";
import { textWidth } from "./labels.ts";
import { TYPE } from "./theme.ts";

interface Run { s: string; sub: boolean }

function parse(src: string): Run[] {
  const out: Run[] = [];
  const ch = [...src];
  let buf = "";
  const flush = () => { if (buf) { out.push({ s: buf, sub: false }); buf = ""; } };
  for (let i = 0; i < ch.length;) {
    if (ch[i] === "_" && i + 1 < ch.length) {
      flush();
      if (ch[i + 1] === "{") {
        const j = ch.indexOf("}", i + 2);
        out.push({ s: ch.slice(i + 2, j).join(""), sub: true });
        i = j + 1;
      } else { out.push({ s: ch[i + 1], sub: true }); i += 2; }
    } else { buf += ch[i]; i++; }
  }
  flush();
  return out;
}

const subSize = (size: number) => Math.max(TYPE.body, Math.round(size * 0.8));

// Width of a label with subscripts, for layout and label placement.
export function subTextWidth(src: string, size: number): number {
  return parse(src).reduce((a, r) => a + textWidth(r.s, r.sub ? subSize(size) : size), 0);
}

// A text element at (x, y) whose "_x" and "_{...}" runs are subscripts.
export function subText(x: number, y: number, src: string, size: number, attrs: Attrs = {}): string {
  let cur = 0, inner = "";
  for (const r of parse(src)) {
    const off = r.sub ? size * 0.3 : 0;
    const dy = off - cur;
    cur = off;
    inner += `<tspan${dy ? ` dy="${Math.round(dy * 10) / 10}"` : ""}${r.sub ? ` font-size="${subSize(size)}"` : ""}>${esc(r.s)}</tspan>`;
  }
  return el("text", { x, y, "font-size": size, ...attrs }, inner);
}
