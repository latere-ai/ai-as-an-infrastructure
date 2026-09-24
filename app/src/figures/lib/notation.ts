// Notation for large quantities and CJK-safe line wrapping, for readouts and
// axes: model and data sizes as the book writes them (70B, 1.4T), FLOP counts
// in scientific notation with superscript exponents (5.76 × 10²³), and a wrap
// that never starts a line with closing punctuation.

import { wrap } from "./labels.ts";

// Counts the way the book writes model and data sizes: 70B, 1.4T, 280M.
export function count(v: number, digits = 3): string {
  const units: Array<[number, string]> = [[1e12, "T"], [1e9, "B"], [1e6, "M"], [1e3, "k"]];
  for (const [u, s] of units) {
    if (Math.abs(v) >= u * 0.9995) return `${trim(v / u, digits)}${s}`;
  }
  return trim(v, digits);
}

function trim(v: number, digits: number): string {
  return String(Number(v.toPrecision(digits)));
}

const SUP: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
const sup = (n: number) => String(n).split("").map((c) => SUP[c] ?? c).join("");

// Scientific notation with a superscript exponent: 5.76 × 10²³, 10²⁰, 3 × 10¹⁹.
export function sci(v: number, digits = 3): string {
  let e = Math.floor(Math.log10(Math.abs(v)));
  let m = Number((v / 10 ** e).toPrecision(digits));
  if (m >= 10) { m /= 10; e += 1; }
  return m === 1 ? `10${sup(e)}` : `${m} × 10${sup(e)}`;
}

// A power of ten for an axis tick: 10¹⁸.
export function pow10(v: number): string {
  return `10${sup(Math.round(Math.log10(v)))}`;
}

// wrap() from lib/labels.ts, plus the CJK line-start rule: a line never starts
// with closing punctuation, so the end of the previous line moves down with it
// (one CJK glyph, or a whole number or Latin word, never part of one).
const NO_LINE_START = new Set([..."，。、；：）」』！？,.;:)"]);
const isCJK = (ch: string) => ch.codePointAt(0)! >= 0x2e80;
export function wrapCJK(s: string, size: number, maxWidth: number): string[] {
  const lines = wrap(s, size, maxWidth);
  for (let i = 1; i < lines.length; i++) {
    const prev = [...lines[i - 1]];
    if (!NO_LINE_START.has([...lines[i]][0]) || prev.length < 2) continue;
    let j = prev.length - 1;
    if (!isCJK(prev[j])) while (j > 0 && !isCJK(prev[j - 1]) && prev[j - 1] !== " ") j--;
    if (j === 0) continue;
    lines[i] = prev.slice(j).join("") + lines[i];
    lines[i - 1] = prev.slice(0, j).join("").trimEnd();
  }
  return lines;
}
