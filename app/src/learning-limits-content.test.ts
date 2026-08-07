import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/frontiers/01-where-learning-hits-limits.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/frontiers/01-where-learning-hits-limits.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/where-learning-hits-limits.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis separates four different limits on learning", () => {
  expect(chapter).toMatch(/^# Where Learning Hits Limits \{#sec-learning-limits\}/);
  for (const phrase of [
    "resource limit",
    "objective limit",
    "adaptation boundary",
    "evidence limit",
    "not interchangeable",
    "failure contract",
  ]) expect(flat).toContain(phrase);
  expect(chapter).not.toContain("/figures/where-learning-hits-limits-1.svg");
  expect(flat).not.toContain("not six separate problems but one scientific question");
});

test("the public-text limit is reported as a conditional forecast", () => {
  for (const phrase of [
    "public human text",
    "raw stock",
    "510 trillion",
    "effective stock",
    "roughly 400 trillion",
    "median crossing year of 2028",
    "2026 to 2032",
    "2.4 times per year",
    "forecast, not an observation",
    "dataset size",
    "training-token exposures",
    "one or two years earlier",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("300 trillion tokens");
  expect(flat).not.toContain("80 percent chance");
  expect(flat).not.toContain("fully consumed");
});

test("the crossing model exposes every assumption", () => {
  for (const marker of [
    "D(t)",
    "D_0 g^{t-t_0}",
    "t^*",
    "\\frac{\\ln(S/D_0)}{\\ln g}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "where:",
    "projected dataset demand",
    "usable stock",
    "annual growth factor",
    "constant exponential growth",
    "sensitivity calculation",
  ]) expect(flat).toContain(phrase);
});

test("the worked data forecast is dependency-free and executable", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toMatch(/numpy|matplotlib|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain("2.4x/year crossing: 2027.75");
  expect(run.stdout.toString()).toContain("1.8x/year crossing: 2029.59");
});

test("synthetic-data evidence distinguishes protocols from universal laws", () => {
  for (const phrase of [
    "replacement protocol",
    "accumulation protocol",
    "opt-125m",
    "wikitext-2",
    "beam search",
    "tail events",
    "finite upper bound",
    "linear-model theorem",
    "does not prove",
    "teacher checkpoint",
    "generation policy",
    "human-data anchor",
    "held-out human evaluation",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the 2025 consensus");
  expect(flat).not.toContain("distribution narrows to noise");
});

test("fixed-data and production-synthetic results stay source-scoped", () => {
  for (const phrase of [
    "200 million tokens",
    "5.17 times",
    "scaling-law extrapolation",
    "not unlimited improvement",
    "180 billion tokens",
    "14 benchmarks",
    "up to 5.1 percentage points",
    "up to 7.7 times",
    "targeted rephrasing",
  ]) expect(flat).toContain(phrase);
});

test("RLVR is separated from capability claims", () => {
  for (const phrase of [
    "reinforcement learning with verifiable rewards",
    "automatic checker",
    "reward coverage",
    "reward hacking",
    "math, coding, and visual reasoning",
    "neurips 2025",
    "prolonged rl",
    "1.5b",
    "different training protocol",
    "does not settle",
  ]) expect(flat).toContain(phrase);
});

test("pass@k measures coverage rather than deployed selection", () => {
  for (const marker of [
    "\\operatorname{pass}@k",
    "1-(1-p)^k",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "independent samples",
    "at least one",
    "coverage metric",
    "selection rule",
    "cannot identify",
  ]) expect(flat).toContain(phrase);
});

test("test-time compute has a generator, judge, and acceptance boundary", () => {
  for (const phrase of [
    "generator",
    "verifier",
    "selector",
    "problem difficulty",
    "more than four times",
    "best-of-n",
    "flops-matched",
    "14 times larger",
    "not a general scaling law",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain('data-chip="GENERATE"');
  expect(chapter).toContain('data-chip="VERIFY"');
  expect(chapter).toContain('data-chip="ACCEPT"');
});

test("deployment memory distinguishes context, external state, and weights", () => {
  for (const marker of [
    "p_{\\theta_t}",
    "c_t",
    "m_t",
    "\\theta_{t+1}",
    "U(\\theta_t,e_t)",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "release policy",
    "not a theoretical inability",
    "stability-plasticity",
    "catastrophic interference",
    "replay",
    "rollback",
    "promotion gate",
  ]) expect(flat).toContain(phrase);
});

test("sparse-memory evidence is not generalized beyond its experiment", () => {
  for (const phrase of [
    "two question-answering tasks",
    "memory-layer models",
    "naturalquestions f1",
    "89 percent",
    "71 percent",
    "11 percent",
    "same level of new-knowledge acquisition",
    "does not demonstrate",
  ]) expect(flat).toContain(phrase);
});

test("hallucination is an acceptance problem, not one universal floor", () => {
  for (const marker of [
    "q(x)",
    "u_{\\mathrm{correct}}",
    "u_{\\mathrm{wrong}}",
    "u_{\\mathrm{abstain}}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "plausible but false",
    "closed-book",
    "retrieval",
    "abstention",
    "confident error",
    "reward guessing",
    "not inevitable",
    "acceptance threshold",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("hallucination as a property, not a bug");
  expect(flat).not.toContain("generative objective guarantees a floor");
});

test("the operating ledger makes each escape route falsifiable", () => {
  for (const phrase of [
    "source provenance",
    "deduplication",
    "contamination",
    "held-out distribution",
    "compute budget",
    "selection policy",
    "retention suite",
    "abstention rate",
    "accepted-answer accuracy",
    "owner",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-scaling-laws",
    "@sec-data-curation",
    "@sec-synthetic-data",
    "@sec-verifiable-rewards",
    "@sec-training-to-reason",
    "@sec-rag-retrieval",
    "@sec-factuality-grounding",
    "@sec-capability-horizon",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-learning-boundaries",
    "fig-data-crossing",
    "fig-synthetic-protocols",
    "fig-learning-state",
    "fig-answer-boundary",
  ]) expect(chapter).toContain(figure);
});

test("the bibliography uses verified primary sources and corrected metadata", () => {
  for (const marker of [
    "proceedings.mlr.press/v235/villalobos24a.html",
    "10.1038/s41586-024-07566-y",
    "arxiv.org/abs/2404.01413",
    "arxiv.org/abs/2107.03374",
    "arxiv.org/abs/2408.03314",
    "10.1073/pnas.1611835114",
    "arxiv.org/abs/2510.15103",
    "arxiv.org/abs/2509.04664",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
  expect(bibliography).toContain("author        = {Maini, Pratyush");
  expect(bibliography).toContain("author        = {Lin, Jessy and Zettlemoyer, Luke");

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(13);
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
    currentHref: "frontiers/where-learning-hits-limits.html",
    chapterTitle: "Where Learning Hits Limits",
    chapterNum: "70",
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
  expect(html).toContain("A limit is useful only when its boundary is named");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(5);
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(5);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
