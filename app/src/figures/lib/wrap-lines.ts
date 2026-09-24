// Line wrapping for mixed Chinese and Latin text that follows both line-edge
// rules of Chinese typesetting: a line never starts with closing punctuation
// (，。）」 and the like) and never ends with opening punctuation (（「 and the
// like). Each opening mark is bound to the unit after it and each closing mark
// to the unit before it, then units are filled greedily, breaking at spaces
// for Latin text and between any two CJK glyphs, as wrap() in labels.ts does.
// Binding marks to their neighbors means no line is widened after the fact.

import { textWidth } from "./labels.ts";

const OPENERS = new Set([..."（「『《〈“‘"]);
const CLOSERS = new Set([..."，。、；：？！）」』》〉”’%"]);
const isCJK = (ch: string) => ch.codePointAt(0)! >= 0x2e80;

function units(s: string): string[] {
  const raw: string[] = [];
  let word = "";
  for (const ch of s) {
    if (isCJK(ch) || ch === " ") {
      if (word) raw.push(word);
      word = "";
      raw.push(ch);
    } else word += ch;
  }
  if (word) raw.push(word);
  const out: string[] = [];
  let carry = "";
  for (const u of raw) {
    if (OPENERS.has(u)) { carry += u; continue; }
    if (CLOSERS.has(u) && out.length && !carry) { out[out.length - 1] += u; continue; }
    out.push(carry + u);
    carry = "";
  }
  if (carry) out.push(carry);
  return out;
}

export function wrapLines(s: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const tok of units(s)) {
    const next = line + tok;
    if (line.trim() && textWidth(next.trimEnd(), size) > maxWidth) {
      lines.push(line.trimEnd());
      line = tok.trimStart();
    } else line = next;
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}
