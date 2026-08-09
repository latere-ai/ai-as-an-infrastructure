import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/ecosystem/04-economics.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/ecosystem/04-economics.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/economics.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis defines economics as a scoped comparison", () => {
  expect(chapter).toMatch(/^# Compute Markets and Unit Economics \{#sec-economics\}/);
  for (const phrase of [
    "whole stack is a way to spend money",
    "where compute is bought",
    "training and inference are two different kinds of cost",
    "build a model versus buy one through an api",
    "inference dominates the lifetime bill",
    "workload",
    "service objective",
    "time horizon",
    "accounting boundary",
  ]) expect(flat).toContain(phrase);
});

test("alternatives must deliver the same accepted result", () => {
  for (const phrase of [
    "accepted result",
    "quality threshold",
    "latency",
    "availability",
    "privacy",
    "security",
    "human review",
    "not economically comparable",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("cost per accepted result");
});

test("the full-cost ledger defines every term", () => {
  for (const marker of [
    "C_{\\mathrm{total}}",
    "C_{\\mathrm{build}}",
    "C_{\\mathrm{run},t}",
    "C_{\\mathrm{people},t}",
    "C_{\\mathrm{data},t}",
    "C_{\\mathrm{network},t}",
    "C_{\\mathrm{failure},t}",
    "N_{\\mathrm{accept}}",
    "u_{\\mathrm{accept}}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "each symbol makes the accounting boundary explicit",
    "evaluation interval",
    "accepted result",
    "idle capacity",
    "failed and retried work",
    "shared-cost allocation",
  ]) expect(flat).toContain(phrase);
});

test("inference unit cost uses realized useful work without double counting utilization", () => {
  for (const marker of [
    "r_{\\mathrm{eff}}",
    "H_{\\mathrm{billed}}",
    "N_{\\mathrm{accept}}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "realized throughput",
    "do not divide by utilization again",
    "input tokens",
    "output tokens",
    "cached tokens",
    "request mix",
    "tail latency",
  ]) expect(flat).toContain(phrase);
});

test("compute procurement options retain their capacity and interruption semantics", () => {
  for (const phrase of [
    "owned capacity",
    "reserved",
    "on-demand",
    "spot",
    "capacity assurance",
    "commitment risk",
    "interruption",
    "checkpoint",
    "restart cost",
    "egress",
  ]) expect(flat).toContain(phrase);
});

test("historical cost evidence remains bounded to what each source measured", () => {
  for (const phrase of [
    "estimate",
    "frontier models",
    "2.4 times per year",
    "final training run",
    "2.788 million h800 gpu-hours",
    "self-reported",
    "research",
    "ablation",
    "not included",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("a parameter count is a training bill");
});

test("price trends are measurements rather than forecasts", () => {
  for (const phrase of [
    "fixed capability threshold",
    "task-dependent",
    "listed price",
    "input and output",
    "do not extrapolate",
    "capability drift",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the scissors");
});

test("build versus buy uses both a complete comparison and a bounded shortcut", () => {
  for (const marker of [
    "C_{\\mathrm{buy}}",
    "C_{\\mathrm{self}}",
    "V^*",
    "\\frac{F}{p-c}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "same capability",
    "constant prices",
    "no capacity steps",
    "switching cost",
    "exit cost",
    "sensitivity analysis",
    "p > c",
  ]) expect(flat).toContain(phrase);
});

test("capacity planning uses the demand distribution rather than an average", () => {
  for (const phrase of [
    "arrival distribution",
    "peak",
    "burst",
    "headroom",
    "queue",
    "capacity step",
    "p50",
    "p95",
    "p99",
  ]) expect(flat).toContain(phrase);
});

test("cash accounting expense and economic cost are not conflated", () => {
  for (const phrase of [
    "cash flow",
    "accounting expense",
    "economic cost",
    "depreciation",
    "useful life",
    "opportunity cost",
    "salvage value",
    "financing",
    "does not change the cash already paid",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("training is a @gls-capex: a capital-style, one-time spend");
});

test("the operating workflow closes forecast against actuals", () => {
  for (const phrase of [
    "freeze the workload",
    "screen feasibility",
    "measure the candidates",
    "normalize the ledger",
    "model scenarios",
    "exercise the exit",
    "approve the commitment",
    "reconcile actuals",
    "forecast error",
  ]) expect(flat).toContain(phrase);
});

test("the runnable exposes price and demand sensitivity without dependencies", () => {
  const cells = [...chapter.matchAll(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/g)];
  expect(cells.length).toBe(1);
  expect(cells[0][1]).not.toMatch(/numpy|torch|requests|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cells[0][1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toBe(
    "base: buy=$3.20M self=$3.05M -> self-host\n" +
      "api-price-down: buy=$2.08M self=$3.05M -> API\n" +
      "demand-down: buy=$1.60M self=$2.85M -> API\n" +
      "peak-capacity-up: buy=$3.20M self=$3.65M -> API\n",
  );
});

test("the rewrite removes categorical and speculative legacy framing", () => {
  for (const phrase of [
    "training is paid once and inference is paid forever",
    "single break-even",
    "the build-versus-buy default has inverted",
    "money moves in circles",
    "demand manufacturing its own evidence",
    "the technology being real does not settle the question",
    "information-processing investment",
    "railway mania",
  ]) expect(flat).not.toContain(phrase);
});

test("stable interfaces and cross-layer handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  expect(chapter).toContain('data-viz="cost-crossover"');
  for (const ref of [
    "@sec-tooling-ecosystem",
    "@sec-scaling-laws",
    "@sec-serving-problem",
    "@sec-memory-scheduling",
    "@sec-powering-ai",
    "@sec-market-structure",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-economics-ledger",
    "fig-economics-cost-crossover",
    "fig-economics-decision",
  ]) expect(chapter).toContain(figure);
});

test("hard wraps do not split hyphenated compounds", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("the bibliography favors archival research and primary records", () => {
  for (const marker of [
    "proceedings.neurips.cc/paper_files/paper/2022/hash/c1e2faff6f588870935f114ebe04a3e5",
    "proceedings.mlr.press/v235/sardana24a.html",
    "arxiv.org/abs/2405.21015",
    "arxiv.org/abs/2412.19437",
    "epoch.ai/data-insights/llm-inference-price-trends",
    "docs.aws.amazon.com/decision-guides/latest/ec2-purchasing-options-aws-how-to-choose",
    "iea.org/reports/energy-and-ai",
    "sec.gov/archives/edgar/data/1018724",
    "bis.org/publ/qtrpdf/r_qt2603u.htm",
  ]) expect(bibliography.toLowerCase()).toContain(marker);

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(8);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the shared bibliography keeps citations used by the Chinese chapter", () => {
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

test("the complete chapter renders without swallowing figures or late prose", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/economics.html",
    chapterTitle: "Compute Markets and Unit Economics",
    chapterNum: "76",
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
  expect(html).toContain("A cheap token is not necessarily a cheap result");
  expect(html.match(/<figure/g)?.length).toBe(3);
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(2);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
