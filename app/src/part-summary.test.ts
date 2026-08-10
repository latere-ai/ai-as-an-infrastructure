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

const parts: Array<[string, string]> = [
  ["orientation", "orientation/03-borrowed-ideas.qmd"],
  ["foundations", "foundations/07-mid-training.qmd"],
  ["generative", "generative/05-beyond-text.qmd"],
  ["adaptation", "adaptation/07-synthetic-data-self-improvement.qmd"],
  ["reasoning", "reasoning/07-inference-time-scaling.qmd"],
  ["inference", "inference/06-serving-multimodal.qmd"],
  ["orchestration", "orchestration/10-context-engineering.qmd"],
  ["evaluation", "evaluation/07-operational-evaluation.qmd"],
  ["safety", "safety/08-law-regulation-policy.qmd"],
  ["infrastructure", "infrastructure/08-the-machine-that-breaks.qmd"],
  ["frontiers", "frontiers/03-verification-frontier.qmd"],
  ["ecosystem", "ecosystem/07-data-rights-economics.qmd"],
  ["practice", "practice/13-operating-contracts.qmd"],
];

const handoffs: Array<[string, string[], string[]]> = [
  ["orientation", ["Part I turns that map into material choices"], ["第一部分会把这张地图落到真实支出上"]],
  ["foundations", ["Part II steps sideways", "do not arrive as natural strings"], ["第二部分转向另一类生成问题", "不天然以字符串形式出现的对象"]],
  ["generative", ["Part III returns to behavior"], ["第三部分会回到行为本身"]],
  ["adaptation", ["Part IV asks what can be left to inference time"], ["第四部分将问题转向推断时"]],
  ["reasoning", ["Part V turns that routing problem into serving machinery"], ["第五部分会把这个路由问题转化为服务系统中的具体机制"]],
  ["inference", ["Part VI begins when a served model is asked to do work"], ["第六部分从这里开始"]],
  ["orchestration", ["Part VII supplies that instrument layer"], ["第七部分补上的就是这层仪器"]],
  ["evaluation", ["Part VIII starts from that dependency on evidence"], ["第八部分接着问"]],
  ["safety", ["Part IX moves below the policy surface"], ["第九部分会再往下走"]],
  // The substrate part now hands off to the frontier part (X) rather than
  // straight to economics, and every part after it moved up one numeral. Only
  // the numeral is pinned for the two summaries the split rewrote: their
  // sentences are prose.
  ["infrastructure", ["Part X"], ["第十部分"]],
  ["frontiers", ["Part XI"], ["第十一部分"]],
  ["ecosystem", ["Part XII turns those market constraints into operating contracts"], ["第十二部分把这些市场约束落实为运营契约"]],
];

test("part summaries are standalone narrative pages, not intro checklists", () => {
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

test("every non-final part summary hands off to the next structural question", () => {
  expect(handoffs.length).toBe(parts.length - 1);
  expect(handoffs.map(([part]) => part)).toEqual(parts.slice(0, -1).map(([part]) => part));

  for (const [part, enPhrases, zhPhrases] of handoffs) {
    const enSummary = src(`en/${part}/summary.qmd`);
    for (const phrase of enPhrases) {
      // Ends on a word boundary so "Part X" is not satisfied by "Part XI".
      const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b");
      expect(re.test(enSummary), `en/${part}/summary.qmd missing handoff phrase: ${phrase}`).toBe(true);
    }

    const zhSummary = src(`zh/${part}/summary.qmd`);
    for (const phrase of zhPhrases) {
      expect(zhSummary, `zh/${part}/summary.qmd missing handoff phrase: ${phrase}`).toContain(phrase);
    }
  }
});

test("final part summary closes the book instead of handing off", () => {
  const enSummary = src("en/practice/summary.qmd");
  expect(enSummary).toContain("Practice begins with a user promise");
  expect(enSummary).toContain("dependable infrastructure");
  expect(enSummary).not.toContain("Part XIII");

  const zhSummary = src("zh/practice/summary.qmd");
  expect(zhSummary).toContain("实践从用户承诺开始");
  expect(zhSummary).toContain("可靠基础设施");
  expect(zhSummary).toContain("运营契约发布记录");
  expect(zhSummary).toContain("即便系统已经发生变化或经历故障");
  expect(zhSummary).not.toContain("第十三部分");
  expect(zhSummary).not.toContain("下一部分");
});
