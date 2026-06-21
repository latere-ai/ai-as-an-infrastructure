// One-off: restore Further-reading framing prose the marker swap removed.
//  - ch38/40/23/26: re-insert the intro/note above the generated list.
//  - ch41/44: revert the FR section to its original grouped hand-written prose
//    (d7a1314); their refs/*.bib stay for citations but FR is not refs-driven.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";

const intros: [string, string][] = [
  ["en/p10-practical/38-choosing-a-model.qmd", "First-hand sources first."],
  ["zh/p10-practical/38-choosing-a-model.qmd", "一手来源优先。"],
  ["en/p10-practical/40-training-finetuning-practice.qmd", "First-hand sources first."],
  ["zh/p10-practical/40-training-finetuning-practice.qmd", "一手来源放前面。"],
  ["en/p5-orchestration/23-the-harness.qmd", "Cited sources appear on the book's References page. One item is referenced\ninline only as an attribution and is listed here for the reader who wants the\nprimary artifact."],
  ["zh/p5-orchestration/23-the-harness.qmd", "被引用的来源会出现在本书的参考文献页。下面这一项仅在正文里作为出处被提及，为想要原始材料的读者列在此处。"],
  ["en/p5-orchestration/26-context-engineering.qmd", "The sources cited inline above appear on the book's References page. The\nsurvey below is a fuller map of the field for a reader who wants the broader\nlandscape."],
  ["zh/p5-orchestration/26-context-engineering.qmd", "上面正文中引用的来源会出现在本书的参考文献页。下面这篇综述为想了解更广阔图景的读者提供了该领域更完整的地图。"],
];
for (const [f, prose] of intros) {
  let s = readFileSync(f, "utf8");
  if (!s.includes("::: {#further-reading}")) { console.log("SKIP (no marker) " + f); continue; }
  if (s.includes(prose.split("\n")[0])) { console.log("SKIP (has prose) " + f); continue; }
  s = s.replace("::: {#further-reading}", prose + "\n\n::: {#further-reading}");
  writeFileSync(f, s);
  console.log("intro restored: " + f);
}

const frBounds = (lines: string[], headRe: RegExp): [number, number] | null => {
  const s = lines.findIndex((l) => headRe.test(l));
  if (s < 0) return null;
  let e = lines.length;
  for (let i = s + 1; i < lines.length; i++) if (/^##\s/.test(lines[i])) { e = i; break; }
  return [s, e];
};
const EN = /^##\s+Further [Rr]eading\s*$/, ZH = /^##\s+延伸阅读\s*$/;
const revert: [string, RegExp][] = [
  ["en/p10-practical/41-agents-and-sandboxes.qmd", EN],
  ["zh/p10-practical/41-agents-and-sandboxes.qmd", ZH],
  ["en/p10-practical/44-wiring-a-2026-stack.qmd", EN],
  ["zh/p10-practical/44-wiring-a-2026-stack.qmd", ZH],
];
for (const [f, headRe] of revert) {
  const orig = execFileSync("git", ["show", "d7a1314:" + f], { encoding: "utf8" }).split("\n");
  const cur = readFileSync(f, "utf8").split("\n");
  const ob = frBounds(orig, headRe), cb = frBounds(cur, headRe);
  if (!ob || !cb) { console.log("BOUNDS FAIL " + f); continue; }
  const origFR = orig.slice(ob[0], ob[1]);
  writeFileSync(f, [...cur.slice(0, cb[0]), ...origFR, ...cur.slice(cb[1])].join("\n"));
  console.log("FR reverted to grouped prose: " + f + " (" + origFR.length + " lines)");
}
