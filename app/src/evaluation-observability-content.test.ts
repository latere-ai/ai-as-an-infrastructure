import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/07-evaluation-and-observability.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/evaluation-and-observability.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter begins with an evaluation release contract", () => {
  expect(chapter).toMatch(/^# Evaluation and Observability \{#sec-eval-practice\}/);
  for (const phrase of [
    "evaluation release",
    "system fingerprint",
    "decision claim",
    "population",
    "slice",
    "release gate",
    "rollback",
  ]) expect(flat).toContain(phrase);
});

test("the evaluated system is versioned beyond the model", () => {
  for (const phrase of [
    "model revision",
    "prompt revision",
    "retrieval snapshot",
    "tool schema",
    "policy revision",
    "gateway configuration",
  ]) expect(flat).toContain(phrase);
});

test("evaluation, observability, and monitoring have distinct jobs", () => {
  for (const phrase of [
    "evaluation asks",
    "observability records",
    "monitoring compares",
    "partial evidence",
    "not a label",
  ]) expect(flat).toContain(phrase);
});

test("the dataset contract prevents production-data leakage", () => {
  for (const phrase of [
    "provenance",
    "consent",
    "deduplicate",
    "split assignment",
    "holdout",
    "contamination",
    "triage",
    "adjudicate",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("a production trace is a ready-made test case");
});

test("cases and stochastic trials are different units", () => {
  for (const phrase of [
    "evaluation case",
    "stochastic trial",
    "repeated trial",
    "case weight",
    "random seed",
  ]) expect(flat).toContain(phrase);
});

test("metrics preserve slices and explicit outcome states", () => {
  for (const phrase of [
    "deterministic check",
    "human judgment",
    "operational metric",
    "security",
    "invalid",
    "error",
    "abstain",
    "fallback",
    "slice",
  ]) expect(flat).toContain(phrase);
});

test("the paired estimand and uncertainty are self-contained", () => {
  for (const marker of [
    "\\widehat{\\Delta}",
    "s_{ir}^{B}",
    "s_{ir}^{A}",
    "R_i",
    "w_i",
    "\\sum_i w_i",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "candidate system",
    "baseline system",
    "resample cases",
    "confidence interval",
    "repeated trials are not independent cases",
  ]) expect(flat).toContain(phrase);
});

test("release gates combine hard constraints and non-inferiority", () => {
  for (const marker of ["\\delta_j", "L_j", "-\\delta_j"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "hard constraint",
    "non-inferiority margin",
    "lower confidence bound",
    "every required slice",
  ]) expect(flat).toContain(phrase);
});

test("a model judge is calibrated as a measurement instrument", () => {
  for (const phrase of [
    "judge revision",
    "rubric revision",
    "human-labeled",
    "criterion and slice",
    "position bias",
    "verbosity bias",
    "self-preference",
    "disagreement",
  ]) expect(flat).toContain(phrase);
  for (const phrase of [
    "target a kappa around 0.8",
    "never use the same model family",
    "500×",
    "5,000×",
    "only practical way",
  ]) expect(flat).not.toContain(phrase);
});

test("judge agreement remains runnable without third-party packages", () => {
  expect(chapter).toContain('<div class="viz" data-viz="judge-kappa"></div>');
  expect(chapter).toContain('<figure id="fig-evaluation-and-observability-judge-kappa">');
  const code = [...chapter.matchAll(/```python\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((body) => body.includes("cohen_kappa"));
  expect(code).toBeDefined();
  expect(code).not.toMatch(/numpy|pandas|sklearn/i);
  expect(code).toContain("assert");
  const run = Bun.spawnSync(["python3", "-c", code!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(new TextDecoder().decode(run.stderr)).toBe("");
  expect(run.exitCode).toBe(0);
  expect(new TextDecoder().decode(run.stdout)).toContain("agreement=0.89, kappa=0.53");
});

test("the telemetry contract defines traces, spans, events, and links", () => {
  for (const phrase of [
    "trace id",
    "span id",
    "parent span",
    "span event",
    "span link",
    "operation name",
    "status",
    "input digest",
    "output digest",
  ]) expect(flat).toContain(phrase);
});

test("distributed context is correlatable without leaking secrets", () => {
  for (const phrase of [
    "w3c trace context",
    "traceparent",
    "baggage",
    "personally identifiable information",
    "secret",
  ]) expect(flat).toContain(phrase);
});

test("privacy controls happen before export", () => {
  for (const phrase of [
    "data classification",
    "redact before export",
    "raw payload recording is off by default",
    "tenant isolation",
    "retention",
    "deletion",
    "access log",
  ]) expect(flat).toContain(phrase);
});

test("sampling and missing telemetry remain visible", () => {
  for (const phrase of [
    "head sampling",
    "tail sampling",
    "inclusion probability",
    "weighted estimate",
    "missing telemetry",
    "export failure",
    "rare",
    "security",
  ]) expect(flat).toContain(phrase);
});

test("replay fidelity and side effects are bounded", () => {
  for (const phrase of [
    "exact replay",
    "structural replay",
    "semantic replay",
    "external state",
    "model alias",
    "side effect",
    "idempotent",
  ]) expect(flat).toContain(phrase);
});

test("monitoring alerts are operational contracts, not causal claims", () => {
  for (const phrase of [
    "numerator",
    "denominator",
    "window",
    "threshold",
    "owner",
    "runbook",
    "drift",
    "does not identify the cause",
  ]) expect(flat).toContain(phrase);
});

test("latency and cost cover the accepted task", () => {
  for (const phrase of [
    "end-to-end latency",
    "retry",
    "cache",
    "tool call",
    "judge cost",
    "human review",
    "cost per accepted task",
  ]) expect(flat).toContain(phrase);
});

test("the release path can stop and recover safely", () => {
  for (const phrase of [
    "shadow",
    "canary",
    "last-known-good",
    "rollback trigger",
    "requalification trigger",
    "evaluation release record",
  ]) expect(flat).toContain(phrase);
});

test("the failure matrix covers realistic evidence failures", () => {
  for (const phrase of [
    "judge disagreement",
    "missing span",
    "sampling bias",
    "privacy leak",
    "stale fingerprint",
    "holdout leakage",
    "tool side effect",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes volatile catalogs and universal defaults", () => {
  for (const phrase of [
    "as of mid-2026",
    "the 2026 shakeout",
    "pick it when",
    "best for",
    "a sensible default",
    "reported acquisition",
    "per 1k traces",
  ]) expect(flat).not.toContain(phrase);
  for (const marker of [
    "fig-eval-loop",
    "fig-evaluation-contract",
    "fig-observability-path",
    "@sec-benchmarks",
    "@sec-statistical-reliability",
    "@sec-human-evaluation-rubrics",
    "@sec-judging-holistic",
    "@sec-factuality-grounding",
    "@sec-evaluating-agents",
    "@sec-operational-evaluation",
    "@sec-serving-stack",
    "@sec-wiring-stack",
    "@sec-agents-practice",
    "@sec-training-practice",
    "@gls-observability",
    "::: {#further-reading}",
  ]) expect(chapter).toContain(marker);
});

test("the bibliography uses primary research and official standards", () => {
  for (const title of [
    "Hidden Technical Debt in Machine Learning Systems",
    "The ML Test Score",
    "Holistic Evaluation of Language Models",
    "Bootstrap Methods: Another Look at the Jackknife",
    "A Coefficient of Agreement for Nominal Scales",
    "Judging LLM-as-a-Judge",
    "G-Eval: NLG Evaluation",
    "Large Language Models are not Fair Evaluators",
    "Recognize and Favor Their Own Generations",
    "Trace Context",
    "Artificial Intelligence Risk Management Framework",
  ]) expect(bibliography).toContain(title);
});

test("hard wraps and citations remain mechanically sound", () => {
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

test("the complete chapter renders through its release handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/evaluation-and-observability.html",
    chapterTitle: "Evaluation and Observability",
    chapterNum: "87",
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
  expect(html).toContain("The output is an evaluation release record");
  expect(headings.some(({ text }) => text.includes("s_{"))).toBeFalse();
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses through the production path and fits mobile", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  const svgs: string[] = [];
  for (const block of blocks) {
    const svg = renderDot(
      graphviz,
      block[1],
      new Map(),
      "practice/evaluation-and-observability.html",
      "",
    );
    svgs.push(svg);
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
  for (const label of ["Redact", "Sample", "Export"])
    expect(svgs[2], `observability diagram should show ${label}`).toContain(`>${label}<`);
});
