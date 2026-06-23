import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function src(p: string) {
  return readFileSync(new URL("../../" + p, import.meta.url), "utf8");
}

function paragraphs(text: string) {
  return text
    .replace(/^# .+\n+/, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

test("part summaries are standalone narrative pages, not intro checklists", () => {
  const parts: Array<[string, string]> = [
    ["orientation", "orientation/03-borrowed-ideas.qmd"],
    ["foundations", "foundations/07-mid-training.qmd"],
    ["generative", "generative/05-beyond-text.qmd"],
    ["adaptation", "adaptation/07-synthetic-data-self-improvement.qmd"],
    ["reasoning", "reasoning/07-inference-time-scaling.qmd"],
    ["inference", "inference/06-serving-multimodal.qmd"],
    ["orchestration", "orchestration/08-context-engineering.qmd"],
    ["evaluation", "evaluation/07-operational-evaluation.qmd"],
    ["safety", "safety/07-law-regulation-policy.qmd"],
    ["infrastructure", "infrastructure/08-the-capability-horizon.qmd"],
    ["ecosystem", "ecosystem/06-data-rights-economics.qmd"],
    ["practice", "practice/13-operating-contracts.qmd"],
  ];

  for (const [part, lastSubstantiveChapter] of parts) {
    const summary = `${part}/summary.qmd`;

    const enYml = src("en/book.yml");
    expect(enYml.indexOf(summary), `en/${summary} missing from book.yml`).toBeGreaterThan(enYml.indexOf(lastSubstantiveChapter));
    expect(src(`en/${part}/index.qmd`)).not.toContain("## Part reflection");
    expect(src(`en/${part}/index.qmd`)).not.toContain("**Covered:**");
    const enSummary = src(`en/${summary}`);
    expect(enSummary).toContain(`# Summary {#part-${part}-summary .unnumbered}`);
    expect(enSummary).not.toContain("**Covered:**");
    expect(enSummary).not.toMatch(/^- \*\*/m);
    expect(paragraphs(enSummary).length, `en/${summary} should be narrative prose`).toBeGreaterThanOrEqual(2);

    const zhYml = src("zh/book.yml");
    expect(zhYml.indexOf(summary), `zh/${summary} missing from book.yml`).toBeGreaterThan(zhYml.indexOf(lastSubstantiveChapter));
    expect(src(`zh/${part}/index.qmd`)).not.toContain("## 本部分小结");
    expect(src(`zh/${part}/index.qmd`)).not.toContain("**覆盖内容：**");
    const zhSummary = src(`zh/${summary}`);
    expect(zhSummary).toContain(`# 小结 {#part-${part}-summary .unnumbered}`);
    expect(zhSummary).not.toContain("**覆盖内容：**");
    expect(zhSummary).not.toMatch(/^- \*\*/m);
    expect(paragraphs(zhSummary).length, `zh/${summary} should be narrative prose`).toBeGreaterThanOrEqual(2);
  }
});

test("foundations summary hands off to generative and multimodal architectures", () => {
  const enSummary = src("en/foundations/summary.qmd");
  expect(enSummary).toContain("Part II");
  expect(enSummary).toContain("image, a sound, a video");
  expect(enSummary).toContain("do not arrive as natural strings");

  const zhSummary = src("zh/foundations/summary.qmd");
  expect(zhSummary).toContain("第二部分");
  expect(zhSummary).toContain("图像、声音、视频");
  expect(zhSummary).toContain("不是「文本之后还有多模态」");
});
