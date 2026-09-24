// Token tiles: a symbol, piece, or character drawn as a small labeled box, and
// a row layout that wraps tiles to the column. Tokenizer figures use them for
// BPE symbols, tokenizer pieces, and the code points of an input string.
// Invisible characters get a visible stand-in so every tile has a label.

import { el, text } from "./svg.ts";
import { textWidth } from "./labels.ts";
import { C } from "./theme.ts";

// Visible stand-ins for characters that print nothing or print badly alone.
const STAND_IN: Record<string, string> = {
  " ": "␣",
  "\n": "⏎",
  "\t": "⇥",
  "‍": "ZWJ",
  " ": "NBSP",
  "́": "◌́",
};

// The label of one character.
export function showChar(ch: string): string {
  return STAND_IN[ch] ?? ch;
}

// A piece's label: each character through showChar.
export function showText(s: string): string {
  return [...s].map(showChar).join("");
}

export interface TileStyle {
  fill?: string; // background, a theme token
  opacity?: number; // background opacity
  stroke?: string;
  dash?: string;
  strokeWidth?: number;
  cls?: string; // text role class
  pattern?: string; // url(#id) fill drawn under the label
}

export const TILE_PAD = 5;

// Label width: textWidth, widened for glyphs that fall back to other fonts
// (emoji, the ▁ block, the stand-ins above) and zero for combining marks.
export function labelWidth(s: string, size: number): number {
  let px = 0;
  for (const ch of s) {
    const c = ch.codePointAt(0)!;
    if (c >= 0x300 && c <= 0x36f) continue;
    if (c >= 0x1f000 || (c >= 0x2600 && c <= 0x27bf)) px += 1.3 * size;
    else if (ch === "▁") px += 0.8 * size;
    else if (ch === "⏎" || ch === "⇥" || ch === "◌") px += 0.9 * size;
    else if (ch === "␣") px += 0.65 * size;
    else if (ch === "⟨" || ch === "⟩") px += 0.4 * size;
    else px += textWidth(ch, size);
  }
  return px;
}

export function tileWidth(label: string, size: number, min = 0): number {
  return Math.max(min, labelWidth(label, size) + 2 * TILE_PAD);
}

// One tile with its label centered.
export function tile(x: number, y: number, w: number, h: number, label: string, size: number, s: TileStyle = {}): string {
  return (s.pattern ? el("rect", { x, y, width: w, height: h, rx: 3, fill: s.pattern }) : "")
    + el("rect", {
      x, y, width: w, height: h, rx: 3,
      fill: s.pattern ? "none" : (s.fill ?? C.panel), "fill-opacity": s.opacity,
      stroke: s.stroke ?? C.rule, "stroke-width": s.strokeWidth ?? 1, "stroke-dasharray": s.dash,
    })
    + text(x + w / 2, y + h / 2 + size * 0.36, label, { "font-size": size, "text-anchor": "middle", class: s.cls });
}

export interface Placed { x: number; row: number }

// Left-to-right layout of widths into rows no wider than maxW. `breakBefore`
// marks items that start a group (an extra `groupGap` before them), and a
// group that fits on one row is moved to the next row whole rather than split.
export function flow(widths: number[], maxW: number, gap: number, breakBefore: boolean[] = [], groupGap = 0): { at: Placed[]; rows: number; rowWidths: number[] } {
  const at: Placed[] = [];
  let x = 0, row = 0;
  const rowWidths: number[] = [0];
  // Width of the group that starts at i.
  const groupWidth = (i: number) => {
    let w = widths[i];
    for (let j = i + 1; j < widths.length && !breakBefore[j]; j++) w += gap + widths[j];
    return w;
  };
  for (let i = 0; i < widths.length; i++) {
    const lead = i === 0 ? 0 : breakBefore[i] ? gap + groupGap : gap;
    const gw = breakBefore[i] && i > 0 ? groupWidth(i) : widths[i];
    const need = gw <= maxW ? gw : widths[i];
    if (x > 0 && x + lead + need > maxW) {
      row++;
      x = 0;
      rowWidths.push(0);
    } else x += lead;
    at.push({ x, row });
    x += widths[i];
    rowWidths[row] = x;
  }
  return { at, rows: row + 1, rowWidths };
}
