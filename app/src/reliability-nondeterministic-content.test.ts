import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/10-reliability-nondeterministic.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/reliability-nondeterministic.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter begins with a user-visible reliability contract", () => {
  expect(chapter).toMatch(
    /^# Reliability for Nondeterministic Systems \{#sec-reliability\}/,
  );
  for (const phrase of [
    "user-visible outcome",
    "reliability contract",
    "response bytes",
    "deterministic invariants",
    "statistical evidence",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("classical site reliability engineering rests on an assumption");
});

test("the contract separates outcome dimensions and measurement coverage", () => {
  for (const phrase of [
    "eligible event",
    "availability",
    "latency",
    "semantic quality",
    "policy",
    "freshness",
    "effect correctness",
    "measurement coverage",
    "slice",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("fig-reliability-contract");
});

test("SLI specification is distinct from its implementation", () => {
  for (const phrase of [
    "sli specification",
    "sli implementation",
    "population",
    "observation window",
    "system release",
    "missing-data rule",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("@gls-sli, a quantitative indicator of one service property");
  expect(flat).not.toContain("an @gls-sli is the proportion of valid events");
});

test("sampled semantic evidence defines inclusion, weighting, and missingness", () => {
  for (const marker of ["Y_i", "\\pi_i", "i \\in S", "1/\\pi_i"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "inclusion probability",
    "weighted ratio",
    "representative probability sample",
    "diagnostic sample",
    "unknown, not a pass",
    "label delay",
    "censor",
  ]) expect(flat).toContain(phrase);
});

test("judges are versioned, calibrated, and audited", () => {
  for (const phrase of [
    "judge version",
    "rubric version",
    "human audit",
    "false positive",
    "false negative",
    "evaluator drift",
  ]) expect(flat).toContain(phrase);
});

test("SLO policy keeps sampled evidence separate from the error budget", () => {
  for (const phrase of [
    "objective",
    "error budget",
    "sampled labels are evidence",
    "multiwindow",
    "burn rate",
    "low-traffic",
    "release gate",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("error budget is then denominated in failed samples");
  expect(flat).not.toContain("slo is a band rather than a line");
});

test("task reliability states the chain rule before the iid shortcut", () => {
  for (const marker of [
    "P(S_1,\\ldots,S_n)",
    "P(S_k \\mid S_1,\\ldots,S_{k-1})",
    "p^n",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "chain rule",
    "independent",
    "identical",
    "fixed number",
    "fatal",
    "checkpoint",
    "lost work",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain('data-family="pow-base"');
});

test("the runnable example is dependency-free and self-checking", () => {
  expect(chapter).toContain("import math");
  expect(chapter).toContain("assert");
  expect(chapter).not.toContain("import numpy");
  expect(chapter).not.toContain("import matplotlib");
});

test("retry policy distinguishes failure classes and has one owner", () => {
  for (const phrase of [
    "transient transport",
    "rate limit",
    "semantic failure",
    "policy failure",
    "unknown commit",
    "one retry owner",
    "retry budget",
    "deadline",
    "backoff",
    "jitter",
  ]) expect(flat).toContain(phrase);
});

test("idempotency is scoped and is not exactly-once execution", () => {
  for (const phrase of [
    "idempotency key",
    "scope",
    "retention",
    "payload identity",
    "response replay",
    "not exactly-once",
  ]) expect(flat).toContain(phrase);
});

test("fallback, degradation, and abstention preserve explicit contracts", () => {
  for (const phrase of [
    "fallback compatibility",
    "authorization",
    "degraded mode",
    "visible",
    "abstention",
    "risk--coverage",
    "handoff rate",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("cannot itself fail to respond");
  expect(flat).not.toContain("always have a last link that cannot fail");
});

test("redundancy accounts for common-mode and correlated failures", () => {
  for (const phrase of [
    "common-mode",
    "conditional diversity",
    "shared provider",
    "shared model",
    "shared prompt",
    "shared retrieval",
    "shared judge",
    "failure-domain matrix",
  ]) expect(flat).toContain(phrase);
});

test("dependency controls include overload and qualified circuit recovery", () => {
  for (const phrase of [
    "timeout",
    "bulkhead",
    "load shedding",
    "minimum sample",
    "probe concurrency",
    "recovery criterion",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("fig-reliability-breaker");
  expect(flat).not.toContain("tools are deterministic services");
});

test("latency hedging is separate from quality redundancy", () => {
  for (const phrase of [
    "latency hedge",
    "quality redundancy",
    "read-only",
    "cancel the loser",
    "load amplification",
    "fastest response",
  ]) expect(flat).toContain(phrase);
});

test("determinism is a full replay contract rather than a correctness claim", () => {
  for (const phrase of [
    "exact-replay contract",
    "model revision",
    "prompt",
    "retrieval",
    "tool",
    "runtime",
    "hardware",
    "batch",
    "does not prove correctness",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("an operator has to take a side");
  expect(flat).not.toContain("vllm_batch_invariant");
  expect(flat).not.toContain("near 2x");
  expect(flat).not.toContain("closer to 1.3x");
});

test("quality incidents fail unknown, contain harm, and preserve evidence", () => {
  for (const phrase of [
    "quality incident",
    "telemetry failure",
    "unknown",
    "contain",
    "disable",
    "rollback",
    "preserve evidence",
    "validate recovery",
  ]) expect(flat).toContain(phrase);
});

test("scenario tests and a reliability release record close the loop", () => {
  for (const phrase of [
    "scenario test",
    "judge outage",
    "provider degradation",
    "stale retrieval",
    "duplicate effect",
    "reliability release record",
  ]) expect(flat).toContain(phrase);
});

test("stable interfaces survive while misleading absolutes disappear", () => {
  for (const marker of [
    "#sec-reliability",
    "fig-reliability-nondeterministic-curve",
    "fig-reliability-fallback",
    "fig-reliability-breaker",
    "@sec-serving-problem",
    "@sec-statistical-reliability",
    "@sec-deployment-lifecycle",
    "::: {#further-reading}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "never twice the same",
    "single most important fact",
    "two sound responses",
    "the deepest limit",
  ]) expect(flat).not.toContain(phrase);
});

test("the bibliography owns durable primary and official sources", () => {
  for (const title of [
    "Implementing SLOs",
    "Alerting on SLOs",
    "The Tail at Scale",
    "Timeouts, Retries, and Backoff with Jitter",
    "Making Retries Safe with Idempotent APIs",
    "HTTP Semantics",
    "A Generalization of Sampling Without Replacement from a Finite Universe",
    "On the Foundations of Noise-free Selective Classification",
    "An Experimental Evaluation of the Assumption of Independence in Multi-Version Programming",
    "Batch Invariance",
  ]) expect(bibliography).toContain(title);
});

test("hard wraps, citations, and math remain mechanically sound", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
  for (const delimiter of ["\\(", "\\)", "\\[", "\\]"])
    expect(chapter).not.toContain(delimiter);
  const citeKeys = new Set(
    [...chapter.matchAll(/(?<![A-Za-z0-9])@([A-Za-z][A-Za-z0-9]*)/g)]
      .map((match) => match[1])
      .filter((key) => !/^(sec|fig|tbl|eq|gls)/.test(key)),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(10);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the complete chapter renders through its operational handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/reliability-nondeterministic.html",
    chapterTitle: "Reliability for Nondeterministic Systems",
    chapterNum: "90",
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
  expect(html).toContain("reliability release record");
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses through the production path and fits mobile", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = renderDot(
      graphviz,
      block[1],
      new Map(),
      "practice/reliability-nondeterministic.html",
      "",
    );
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
