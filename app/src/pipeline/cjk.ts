// Replicate cjk-softbreak.lua: a soft line break between two CJK characters in
// the source should not become a space in the output. We collapse such breaks
// before markdown parsing so wrapped Chinese prose reads without stray gaps.
// Only applied to the zh side.

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
