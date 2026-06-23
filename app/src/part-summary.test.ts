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
    expect(paragraphs(enSummary).length, `en/${summary} should stay concise`).toBeLessThanOrEqual(3);

    const zhYml = src("zh/book.yml");
    expect(zhYml.indexOf(summary), `zh/${summary} missing from book.yml`).toBeGreaterThan(zhYml.indexOf(lastSubstantiveChapter));
    expect(src(`zh/${part}/index.qmd`)).not.toContain("## 本部分小结");
    expect(src(`zh/${part}/index.qmd`)).not.toContain("**覆盖内容：**");
    const zhSummary = src(`zh/${summary}`);
    expect(zhSummary).toContain(`# 小结 {#part-${part}-summary .unnumbered}`);
    expect(zhSummary).not.toContain("**覆盖内容：**");
    expect(zhSummary).not.toMatch(/^- \*\*/m);
    expect(paragraphs(zhSummary).length, `zh/${summary} should be narrative prose`).toBeGreaterThanOrEqual(2);
    expect(paragraphs(zhSummary).length, `zh/${summary} should stay concise`).toBeLessThanOrEqual(3);
  }
});

test("part summaries hand off to the next structural question", () => {
  const handoffs: Array<[string, string[], string[]]> = [
    ["orientation", ["Part I turns that map into material choices"], ["第一部分会把这张地图落到真实支出上"]],
    ["foundations", ["Part II steps sideways", "do not arrive as natural strings"], ["第二部分会暂时离开", "不是「文本之后还有多模态」"]],
    ["generative", ["Part III returns to behavior"], ["第三部分会回到行为本身"]],
    ["adaptation", ["Part IV asks what can be left to inference time"], ["第四部分要问的是"]],
    ["reasoning", ["Part V turns that routing problem into serving machinery"], ["第五部分会把这个路由问题落到服务机器上"]],
    ["inference", ["Part VI begins when a served model is asked to do work"], ["第六部分从这里开始"]],
    ["orchestration", ["Part VII supplies that instrument layer"], ["第七部分要补上的正是这层仪器"]],
    ["evaluation", ["Part VIII starts from that dependency on evidence"], ["第八部分接着问"]],
    ["safety", ["Part IX moves below the policy surface"], ["第九部分会再往下走"]],
    ["infrastructure", ["next part can turn to economics"], ["下一部分转向经济"]],
    ["ecosystem", ["Part XI turns those market constraints into operating contracts"], ["第十一部分会把这些市场约束变成运营契约"]],
  ];

  for (const [part, enPhrases, zhPhrases] of handoffs) {
    const enSummary = src(`en/${part}/summary.qmd`);
    for (const phrase of enPhrases) {
      expect(enSummary, `en/${part}/summary.qmd missing handoff phrase: ${phrase}`).toContain(phrase);
    }

    const zhSummary = src(`zh/${part}/summary.qmd`);
    for (const phrase of zhPhrases) {
      expect(zhSummary, `zh/${part}/summary.qmd missing handoff phrase: ${phrase}`).toContain(phrase);
    }
  }
});
