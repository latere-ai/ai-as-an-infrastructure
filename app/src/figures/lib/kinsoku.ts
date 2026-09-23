// Line wrapping that keeps CJK closing punctuation off the start of a line.
// wrap() in labels.ts may break between any two CJK glyphs, so a line can
// begin with "，" or "。"; Chinese typesetting (kinsoku) keeps those marks at
// the end of the previous line instead. The mark is moved back, which can make
// that line up to one glyph wider than maxWidth.

import { wrap } from "./labels.ts";

const NO_START = /^[，。、；：？！）」』》〉’”%]/u;

export function wrapCjk(s: string, size: number, maxWidth: number): string[] {
  const lines = wrap(s, size, maxWidth);
  for (let i = 1; i < lines.length; i++) {
    while (lines[i] && NO_START.test(lines[i])) {
      const ch = [...lines[i]][0];
      lines[i - 1] += ch;
      lines[i] = lines[i].slice(ch.length).trimStart();
    }
  }
  return lines.filter((l) => l.length > 0);
}
