import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

function src(p: string) {
  return readFileSync(new URL("../../" + p, import.meta.url), "utf8");
}

test("part summaries are standalone end-of-part pages, not intro sections", () => {
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
    expect(enSummary).toContain(".unnumbered");
    for (const label of ["**Covered:**", "**Main concern:**", "**Takeaway:**", "**Open question:**"]) {
      expect(enSummary, `en/${summary} missing ${label}`).toContain(label);
    }

    const zhYml = src("zh/book.yml");
    expect(zhYml.indexOf(summary), `zh/${summary} missing from book.yml`).toBeGreaterThan(zhYml.indexOf(lastSubstantiveChapter));
    expect(src(`zh/${part}/index.qmd`)).not.toContain("## 本部分小结");
    expect(src(`zh/${part}/index.qmd`)).not.toContain("**覆盖内容：**");
    const zhSummary = src(`zh/${summary}`);
    expect(zhSummary).toContain(".unnumbered");
    for (const label of ["**覆盖内容：**", "**主要担忧：**", "**带走的判断：**", "**未解问题：**"]) {
      expect(zhSummary, `zh/${summary} missing ${label}`).toContain(label);
    }
  }
});
