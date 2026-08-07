import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/frontiers/02-the-capability-horizon.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/frontiers/02-the-capability-horizon.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/the-capability-horizon.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis treats the frontier as a measurement contract", () => {
  expect(chapter).toMatch(/^# The Capability Horizon and Its Measurement \{#sec-capability-horizon\}/);
  for (const phrase of [
    "frontier is no longer a leaderboard number",
    "moving horizon",
    "not one scalar",
    "measurement contract",
    "snapshot date",
    "durable progress",
    "compute-bought artifact",
    "headline number",
  ]) expect(flat).toContain(phrase);
  expect(chapter).not.toContain("/figures/the-capability-horizon-1.svg");
});

test("the task horizon is defined as a fitted threshold", () => {
  for (const marker of [
    "\\Pr(Y=1\\mid d)",
    "\\sigma(\\alpha-\\beta\\ln d)",
    "\\sigma(z)",
    "h_q",
    "\\operatorname{logit}(q)",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "binary outcome",
    "human completion time",
    "fitted intercept",
    "fitted slope",
    "success threshold",
    "fixed system and protocol",
  ]) expect(flat).toContain(phrase);
});

test("the horizon protocol exposes what changes the estimate", () => {
  for (const phrase of [
    "model checkpoint",
    "agent scaffold",
    "tool access",
    "task distribution",
    "human-time baseline",
    "repeated attempts",
    "token budget",
    "time budget",
    "scoring rule",
    "measurement date",
  ]) expect(flat).toContain(phrase);
});

test("time-horizon results retain their version and uncertainty", () => {
  for (const phrase of [
    "228 tasks",
    "31 tasks",
    "five of those 31",
    "320 minutes",
    "170 to 729 minutes",
    "196.5 days",
    "130.8 days",
    "88.6 days",
    "different fit windows",
    "cannot reliably measure horizons above 16 hours",
    "16 to 20 hours",
    "three to four hours",
    "shared internal model",
    "16 to 64 million tokens",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("~5h → ~15h");
  expect(flat).not.toContain("doubling time of the trend dropping");
});

test("reliability thresholds depend on the fitted slope", () => {
  expect(chapter).toContain("\\frac{h_{0.5}}{h_{0.8}}");
  for (const phrase of [
    "depends on",
    "not a universal constant",
    "independence",
    "homogeneous steps",
    "toy model",
    "not a causal explanation",
  ]) expect(flat).toContain(phrase);
});

test("the illustrative horizon fit is dependency-free and executable", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toMatch(/numpy|matplotlib|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain("fitted slope: 0.847");
  expect(run.stdout.toString()).toContain("50% / 80% horizon ratio: 5.143");
});

test("economic benchmarks remain deliverable comparisons", () => {
  for (const phrase of [
    "1,320 tasks",
    "44 occupations",
    "nine sectors",
    "220-task",
    "14 years",
    "47.6 percent",
    "wins plus ties",
    "84.9 percent",
    "23 april 2026",
    "xhigh reasoning",
    "one-shot",
    "human oversight",
    "not an occupation-automation rate",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the crossing has happened");
});

test("RE-Bench stays scoped to its budgets and scoring protocol", () => {
  for (const phrase of [
    "seven",
    "61 distinct human experts",
    "71 eight-hour attempts",
    "four times",
    "two-hour",
    "eight hours",
    "32 hours",
    "twice",
    "best-of-k",
    "normalized score",
    "not end-to-end research automation",
  ]) expect(flat).toContain(phrase);
});

test("productivity evidence separates randomized and self-selected samples", () => {
  for (const phrase of [
    "16 developers",
    "246 tasks",
    "19 percent longer",
    "24 percent faster",
    "20 percent faster",
    "february to june 2025",
    "returning developers",
    "18 percent speedup",
    "new developers",
    "four percent speedup",
    "selection",
    "does not overturn",
  ]) expect(flat).toContain(phrase);
});

test("benchmark change is reported without mixing protocols", () => {
  for (const phrase of [
    "more than 90 percent",
    "2,500",
    "more than 100 subjects",
    "46.44 percent",
    "no-tools",
    "tool-enabled",
    "less than 5 percent",
    "84.6 percent",
    "different evaluation sets",
    "not solved",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("past the average human score");
});

test("construct validity and adversarial audits retain their scope", () => {
  for (const phrase of [
    "445 benchmark papers",
    "29 experts",
    "eight recommendations",
    "18 demand rubrics",
    "15 language models",
    "63 tasks",
    "ten agent benchmarks",
    "219 flaws",
    "nine of ten",
    "adversarial audit",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("many do not measure any well-defined ability at all");
});

test("forecasting is separated from observation", () => {
  for (const phrase of [
    "eight-parameter",
    "2032",
    "roughly 15 hours",
    "no backtest",
    "little weight on the exact date",
    "scenario",
    "not a measurement",
  ]) expect(flat).toContain(phrase);
});

test("the measurement ledger is operational", () => {
  for (const phrase of [
    "construct",
    "task sample",
    "system definition",
    "resource budget",
    "repetitions",
    "scorer",
    "contamination",
    "adversarial audit",
    "uncertainty",
    "deployment link",
    "owner",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  expect(chapter).toContain("@sec-verification-frontier takes the next step");
  for (const ref of [
    "@sec-evaluating-agents",
    "@sec-machine-breaks",
    "@sec-inference-time-scaling",
    "@sec-training-to-reason",
    "@sec-scaling-laws",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-horizon-contract",
    "fig-horizon-thresholds",
    "fig-economic-transfer",
    "fig-horizon-saturation",
    "fig-the-capability-horizon-curve",
  ]) expect(chapter).toContain(figure);
});

test("hard wraps do not split hyphenated compounds in rendered prose", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("the bibliography uses verified primary sources and corrected metadata", () => {
  for (const marker of [
    "proceedings.mlr.press/v267/wijk25a.html",
    "10.1038/s41586-025-09962-4",
    "10.1038/s41586-026-10303-2",
    "arxiv.org/abs/2605.12673",
    "papers.neurips.cc/paper_files/paper/2025",
    "metr.org/blog/2026-02-24-uplift-update",
    "openai.com/index/introducing-gpt-5-5",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
  expect(bibliography).toContain("author        = {Patwardhan, Tejal");
  expect(bibliography).toContain("author        = {Becker, Joel and Rush, Nate");
  expect(bibliography).toContain("author       = {Kwa, Thomas}");

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(14);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the shared bibliography keeps citations used by the untranslated chapter", () => {
  const citeKeys = new Set(
    [...chineseChapter.matchAll(/@([a-z][a-z0-9]*)/gi)]
      .map((match) => match[1])
      .filter((key) => !/^(sec|fig|tbl|eq|gls)/.test(key)),
  );
  for (const key of citeKeys) {
    expect(bibliography, `${key} should remain available to the Chinese chapter`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the complete chapter renders without swallowing diagrams or late prose", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "frontiers/the-capability-horizon.html",
    chapterTitle: "The Capability Horizon and Its Measurement",
    chapterNum: "71",
    prefix: "../",
    graphviz,
    lang: "en",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings } = renderMarkdown(chapter, ctx);
  expect(html).not.toContain("```rdrdot");
  expect(html).not.toContain("katex-error");
  expect(html).toContain("A frontier claim is useful only when its contract travels with it");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(4);
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(4);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
