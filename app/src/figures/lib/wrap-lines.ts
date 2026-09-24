// wrapCJK() from notation.ts, plus the matching line-end rule: a line never
// ends with opening punctuation, so a "（" or "「" left at the end of a line
// moves to the start of the next one, next to the text it opens.

import { wrapCJK } from "./notation.ts";

const NO_LINE_END = new Set([..."（「『《〈(“‘"]);

export function wrapLines(s: string, size: number, maxWidth: number): string[] {
  const lines = wrapCJK(s, size, maxWidth);
  for (let i = 0; i < lines.length - 1; i++) {
    let line = lines[i].trimEnd();
    while (line.length > 1 && NO_LINE_END.has([...line].at(-1)!)) {
      const ch = [...line].at(-1)!;
      line = line.slice(0, -ch.length).trimEnd();
      lines[i + 1] = ch + lines[i + 1];
    }
    lines[i] = line;
  }
  return lines;
}
