import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chinese = readFileSync(
  new URL("../../zh/contribute.qmd", import.meta.url),
  "utf8",
);
const english = readFileSync(
  new URL("../../en/contribute.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\s+/g, " ");

const expectedHeadings = ["哪些反馈最有帮助", "提交修改", "许可与参与范围"];

test("the Chinese contribution guide preserves the complete English shape", () => {
  expect(chinese).toStartWith("# 如何参与 {.unnumbered}\n");
  expect([...chinese.matchAll(/^## (.+)$/gm)].map((match) => match[1])).toEqual(
    expectedHeadings,
  );
  expect([...chinese.matchAll(/^## /gm)]).toHaveLength(
    [...english.matchAll(/^## /gm)].length,
  );
});

test("the opening gives readers the two shortest contribution paths", () => {
  for (const phrase of [
    "提交问题",
    "编辑本页",
    "出现问题的章节",
    "`.qmd` 源文件",
    "拉取请求",
  ]) expect(flat).toContain(phrase);
  expect(chinese).toContain(
    "https://github.com/latere-ai/ai-as-an-infrastructure",
  );
});

test("a useful report identifies location defect replacement and evidence", () => {
  for (const phrase of [
    "页面标题与小节标题",
    "具体的句子、公式、图示、链接或交互",
    "错误或不清楚之处",
    "应该改成什么",
    "一手资料",
    "发布日期或版本发布日期",
    "浏览器、视口尺寸或错误输出",
  ]) expect(flat).toContain(phrase);
});

test("content presentation and implementation defects are all in scope", () => {
  for (const phrase of [
    "事实错误",
    "过期的数字或名称",
    "难以理解的段落",
    "失效链接",
    "公式无法渲染",
    "图示被截断",
    "阅读器、构建流程或工具",
  ]) expect(flat).toContain(phrase);
});

test("bilingual parity preserves shared meaning rather than literal wording", () => {
  for (const phrase of [
    "同时更新两个语言目录",
    "同一项技术主张",
    "相同的章节结构、来源、公式与图示含义",
    "并非逐句对应的副本",
    "英文或中文都可以",
  ]) expect(flat).toContain(phrase);
});

test("pull request guidance matches repository interfaces and CI", () => {
  for (const phrase of [
    "贡献指南",
    "固定标题",
    "交叉引用",
    "lint",
    "构建中英文版",
    "Bun 内容与阅读器测试",
    "Go 路由测试",
    "不要修改 `_book/`",
  ]) expect(flat).toContain(phrase);
  expect(chinese).toContain(
    "https://github.com/latere-ai/ai-as-an-infrastructure/blob/main/CONTRIBUTING.md",
  );
});

test("the license and repository policy boundaries stay distinct", () => {
  for (const phrase of [
    "CC BY-NC-ND 4.0",
    "署名的非商业分享",
    "不允许公开分享改编版本",
    "著作权人",
    "仓库的贡献政策",
    "更正、澄清与修复",
    "不接受没有指出具体问题的主动改写",
  ]) expect(flat).toContain(phrase);
  expect(chinese).toContain(
    "https://creativecommons.org/licenses/by-nc-nd/4.0/",
  );
});

test("the rewrite removes vague and overcompressed contribution language", () => {
  for (const phrase of [
    "过时是公开发生的",
    "最先发现的往往是读者",
    "就够了",
    "不必特意开一个 issue",
    "有两条比其余都重要",
    "构建即测试",
    "为改写而改写",
  ]) expect(flat).not.toContain(phrase);
  expect(chinese).not.toContain("—");
  expect(chinese).not.toMatch(/\S-\n\S/);
});

test("the complete Chinese guide is concise and renders", async () => {
  expect(chinese.length).toBeGreaterThanOrEqual(1500);
  expect(chinese.length).toBeLessThanOrEqual(4200);

  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "contribute.html",
    chapterTitle: "如何参与",
    chapterNum: "",
    prefix: "",
    graphviz,
    lang: "zh",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings } = renderMarkdown(chinese, ctx);
  expect(html).not.toContain("katex-error");
  expect(html).not.toContain("**");
  expect(html).toContain("出现问题的章节");
  expect(html).toContain("许可与参与范围");
  expect(headings.map((heading) => heading.text)).toEqual(expectedHeadings);
});
