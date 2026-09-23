// CJK handling for the markdown pipeline.
//
// stripCjkSoftBreaks replicates cjk-softbreak.lua: a soft line break between
// two CJK characters in the source should not become a space in the output.
// We collapse such breaks before markdown parsing so wrapped Chinese prose
// reads without stray gaps. Only applied to the zh side.
//
// cjkEmphasis is a markdown-it plugin that makes emphasis delimiter runs next to
// CJK text follow the CJK-friendly flanking rules, so `**标签：**正文` renders
// bold; see the comment on the plugin. It is installed for both languages: it
// only acts on a run with a CJK neighbor.

import type MarkdownIt from "markdown-it";

const CJK = /[　-〿㐀-䶿一-鿿豈-﫿＀-￯]/;

export function stripCjkSoftBreaks(src: string): string {
  const lines = src.split("\n");
  const out: string[] = [];
  let inCode = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(`{3,}|~{3,})/.test(line)) inCode = !inCode;
    if (inCode || line.trim() === "") { out.push(line); continue; }
    const next = lines[i + 1];
    // A heading line is a complete block; its text must not absorb the next
    // line. This matters for a callout whose "## Title" is immediately followed
    // by a CJK body line (no author blank line): joining them would fold the
    // body into the pulled callout title, so its inline refs never render.
    const lineIsHeading = /^\s*#{1,6}\s/.test(line);
    // Join with the next line (no space) when this line ends and the next begins
    // with a CJK char, and the next line is regular prose (not a block marker).
    if (next && !lineIsHeading && CJK.test(line.slice(-1)) && CJK.test(next.trimStart()[0] ?? "") &&
        !/^\s*([#>\-*+:|]|\d+\.|`{3,}|~{3,})/.test(next)) {
      out.push(line);
      lines[i + 1] = line.match(/\s$/) ? next : next.replace(/^\s+/, "");
      // mark join by appending next now and skipping it
      out[out.length - 1] = out[out.length - 1] + lines[i + 1].replace(/^\s+/, "");
      i++;
    } else {
      out.push(line);
    }
  }
  return out.join("\n");
}

// A CJK character as the CJK-friendly emphasis amendment defines it: East Asian
// Width W, F, or H and not a default-emoji code point, or Hangul. The ranges are
// the Unicode blocks that carry those widths: Hangul Jamo; CJK radicals through
// CJK Unified Ideographs Extension A (CJK symbols and punctuation, kana,
// bopomofo, enclosed and compatibility forms); CJK Unified Ideographs; Yi;
// Hangul; CJK compatibility ideographs; vertical, compatibility, and small
// forms; halfwidth and fullwidth forms; and the supplementary ideographic
// blocks. Emoji blocks are excluded. Full-width punctuation such as ：，。；？！、
// and （） falls inside these ranges, so it counts as a CJK character.
const CJK_CHAR = /[\u1100-\u11FF\u2E80-\u4DBF\u4E00-\u9FFF\uA000-\uA4CF\uA960-\uA97F\uAC00-\uD7FF\uF900-\uFAFF\uFE10-\uFE1F\uFE30-\uFE6F\uFF00-\uFFEF\u{16FE0}-\u{18AFF}\u{1B000}-\u{1B2FF}\u{20000}-\u{3FFFD}]/u;

function isCjkCodePoint(code: number): boolean {
  return CJK_CHAR.test(String.fromCodePoint(code));
}

// Code point ending at src[pos - 1], joining a surrogate pair.
function codePointBefore(src: string, pos: number): number {
  const low = src.charCodeAt(pos - 1);
  if ((low & 0xFC00) === 0xDC00 && pos >= 2) {
    const high = src.charCodeAt(pos - 2);
    if ((high & 0xFC00) === 0xD800) return 0x10000 + ((high - 0xD800) << 10) + (low - 0xDC00);
  }
  return low;
}

// CommonMark decides whether a `*`/`_` run opens or closes emphasis from the
// characters on either side of it (the flanking rules). A closing `**` that
// follows punctuation must be followed by whitespace or punctuation, which
// suits English, where a space follows the colon in "**Label:** text". Chinese
// has no such space: in "**标签：**正文" the closing run sits between the
// full-width colon and a CJK letter, is not right-flanking, and the markers
// reach the reader as literal text. The same applies to an opening run between
// a CJK letter and punctuation, as in "中文**“引号”**".
//
// This plugin applies the CJK-friendly amendment to the flanking rules
// (markdown-cjk-friendly, the rules behind markdown-it-cjk-friendly):
// - CJK punctuation (full-width marks) does not count as punctuation when
//   testing whether a run is followed or preceded by punctuation;
// - a CJK character on the far side of adjacent punctuation counts like
//   whitespace, so "是**“引号”**是" opens and closes.
// The can-open and can-close tie-breaks for intraword `_` are left as
// CommonMark has them, so snake_case identifiers stay literal. markdown-it's
// strikethrough rule calls the same scan, so `~~` runs follow the same rules.
// A run with no CJK character on either side takes markdown-it's own result
// unchanged, so text without CJK renders exactly as before. The amendment's
// variation-selector clauses are not implemented; the book's sources contain
// none.
export function cjkEmphasis(md: MarkdownIt): void {
  const { isWhiteSpace, isMdAsciiPunct, isPunctChar } = md.utils;
  const isPunct = (code: number) => isMdAsciiPunct(code) || isPunctChar(String.fromCodePoint(code));

  // ParserInline builds its state with `new this.State(...)`, so replacing the
  // class on this instance scopes the change to this markdown-it instance.
  md.inline.State = class CjkStateInline extends md.inline.State {
    override scanDelims(start: number, canSplitWord: boolean) {
      const scanned = super.scanDelims(start, canSplitWord);
      const end = start + scanned.length;
      // Line start and line end count as whitespace, as in markdown-it.
      const lastChar = start > 0 ? codePointBefore(this.src, start) : 0x20;
      const nextChar = end < this.posMax ? this.src.codePointAt(end)! : 0x20;
      const lastCjk = isCjkCodePoint(lastChar);
      const nextCjk = isCjkCodePoint(nextChar);
      if (!lastCjk && !nextCjk) return scanned;

      const isLastWhiteSpace = isWhiteSpace(lastChar);
      const isNextWhiteSpace = isWhiteSpace(nextChar);
      const isLastPunct = isPunct(lastChar);
      const isNextPunct = isPunct(nextChar);
      const isLastNonCjkPunct = isLastPunct && !lastCjk;
      const isNextNonCjkPunct = isNextPunct && !nextCjk;

      const leftFlanking = !isNextWhiteSpace &&
        (!isNextNonCjkPunct || isLastWhiteSpace || isLastPunct || lastCjk);
      const rightFlanking = !isLastWhiteSpace &&
        (!isLastNonCjkPunct || isNextWhiteSpace || isNextPunct || nextCjk);

      return {
        can_open: leftFlanking && (canSplitWord || !rightFlanking || isLastPunct),
        can_close: rightFlanking && (canSplitWord || !leftFlanking || isNextPunct),
        length: scanned.length,
      };
    }
  };
}
