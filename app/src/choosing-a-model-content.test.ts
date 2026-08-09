import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/01-choosing-a-model.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/practice/01-choosing-a-model.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/choosing-a-model.bib", import.meta.url),
  "utf8",
);
const runtime = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter chooses a versioned served system for a declared workload", () => {
  expect(chapter).toMatch(/^# Choosing a Model \{#sec-choosing-model\}/);
  for (const phrase of [
    "versioned served system",
    "workload contract",
    "hard constraints",
    "quality",
    "cost",
    "latency",
    "availability",
    "operational risk",
    "no universal winner",
  ]) expect(flat).toContain(phrase);
});

test("the candidate identity records every behavior-changing layer", () => {
  for (const phrase of [
    "provider and model id",
    "artifact digest",
    "endpoint and region",
    "prompt template",
    "tool schemas",
    "decoding and reasoning settings",
    "safety policy",
    "cache",
    "router",
    "fallback policy",
    "rate and capacity limits",
  ]) expect(flat).toContain(phrase);
});

test("eligibility is a hard gate and unknown evidence cannot pass", () => {
  for (const marker of [
    "E(m)",
    String.raw`H_{\mathrm{license}}(m)`,
    String.raw`H_{\mathrm{data}}(m)`,
    String.raw`H_{\mathrm{region}}(m)`,
    String.raw`H_{\mathrm{interface}}(m)`,
    String.raw`H_{\mathrm{capacity}}(m)`,
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "every factor is boolean",
    "unknown does not pass",
    "not a weighted score",
    "exception process",
  ]) expect(flat).toContain(phrase);
});

test("artifact access, legal permission, and service terms stay separate", () => {
  for (const phrase of [
    "weights",
    "license",
    "training data",
    "training code",
    "model card",
    "service terms",
    "data retention",
    "training on customer data",
    "do not infer rights from the word open",
    "not legal advice",
  ]) expect(flat).toContain(phrase);
});

test("public benchmarks discover candidates rather than decide production", () => {
  for (const phrase of [
    "candidate discovery",
    "construct match",
    "harness match",
    "uncertainty",
    "data provenance",
    "system being measured",
    "cannot prove contamination",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("read three boards, not one");
  expect(flat).not.toContain("agreement across the three is a strong signal");
});

test("the internal evaluation uses strata, pairing, repetition, and declared precision", () => {
  for (const marker of ["d_i", "y_i^{(m)}", "y_i^{(b)}", "-\\delta"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "workload strata",
    "acceptance rule",
    "paired",
    "repeated trials",
    "baseline",
    "non-inferiority margin",
    "confidence interval",
    "precision target",
    "sample size",
    "judge disagreement",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("50 to 200 items is enough");
});

test("cost is end-to-end cost per accepted task", () => {
  for (const marker of ["C_m", "K_{msr}", "A_{msr}"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "cost per accepted task",
    "same accounting horizon",
    "input tokens",
    "output tokens",
    "tool calls",
    "retries",
    "human review",
    "incident",
    "idle capacity",
    "operations labor",
  ]) expect(flat).toContain(phrase);
});

test("the hosted versus self-hosted crossover states its assumptions", () => {
  for (const marker of ["C_h(N)", "C_s(N)", "N^*"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "fixed cost",
    "variable cost",
    "same currency",
    "same accounting horizon",
    "only when",
    "no positive crossover",
    "capacity steps",
    "quality-equivalent",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain('data-viz="cost-crossover"');
  expect(chapter).toContain('data-x-label="accepted tasks per accounting horizon"');
});

test("selection uses a Pareto frontier and an operational rollout", () => {
  for (const phrase of [
    "pareto frontier",
    "dominated",
    "shadow",
    "canary",
    "rollback",
    "pin",
    "drift",
    "re-evaluation trigger",
    "expiry date",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("a sensible default");
});

test("the English decision tree is generic and product-neutral", () => {
  expect(chapter).toContain('data-viz="decision-tree" data-mode="selection-contract"');
  expect(runtime).toContain("selection-contract");
  for (const phrase of [
    "Satisfies every hard constraint?",
    "Supports the required interface and capacity?",
    "Clears the declared quality gate?",
    "Pareto-efficient on cost, latency, availability, and risk?",
    "Shortlist for shadow and canary rollout",
  ]) expect(runtime).toContain(phrase);
});

test("the gateway is a conditional boundary with tested semantic fallbacks", () => {
  for (const phrase of [
    "@gls-gateway, a routing and policy layer for model calls",
    "provider adapter",
    "design option",
    "tool semantics",
    "structured output",
    "tokenization",
    "streaming",
    "error behavior",
    "policy-compatible fallback",
    "validated by the same evaluation contract",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the app should never talk to a raw vendor sdk");
  expect(flat).not.toContain("the agent code does not change between them");
});

test("the rewrite removes volatile endorsements and invented events", () => {
  for (const phrase of [
    "gpt-5.6",
    "claude opus 4.8",
    "sonnet 5",
    "fable 5",
    "mythos 5",
    "gemini 3.1",
    "deepseek-v4",
    "qwen3.6",
    "gemma 4",
    "glm-5.2",
    "pick claude",
    "pick gpt",
    "pick gemini",
    "master axis: rent or own",
    "mid-2026 snapshot",
  ]) expect(flat).not.toContain(phrase);
});

test("stable chapter interfaces and cross-layer handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-model-landscape",
    "@sec-benchmarks",
    "@sec-statistical-reliability",
    "@sec-evaluating-agents",
    "@sec-judging-holistic",
    "@sec-serving-stack",
    "@sec-quantization-kernels",
    "@sec-wiring-stack",
    "@sec-reliability",
    "@sec-economics",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-model-decision",
    "fig-choosing-a-model-cost-crossover",
    "fig-choosing-a-model-decision-tree",
    "fig-model-wiring",
  ]) expect(chapter).toContain(figure);
});

test("hard wraps do not split hyphenated compounds", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("the bibliography favors primary and archival sources", () => {
  for (const marker of [
    "arxiv.org/abs/2211.09110",
    "10.1145/3287560.3287596",
    "proceedings.mlr.press/v235/chiang24b.html",
    "arxiv.org/abs/2310.06770",
    "arxiv.org/abs/2403.07974",
    "opensource.org/ai/open-source-ai-definition",
    "arxiv.org/abs/2305.05176",
    "arxiv.org/abs/2406.18665",
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

test("the complete chapter renders through its final handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/choosing-a-model.html",
    chapterTitle: "Choosing a Model",
    chapterNum: "81",
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
  expect(html).toContain("The output is a decision record");
  expect(html.match(/<figure[^>]*class="rdr-figure/g)?.length).toBe(4);
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
