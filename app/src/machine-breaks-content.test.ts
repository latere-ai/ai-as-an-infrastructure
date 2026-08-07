import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/infrastructure/08-the-machine-that-breaks.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/infrastructure/08-the-machine-that-breaks.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/the-machine-that-breaks.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis defines reliability at a workload boundary", () => {
  expect(chapter).toMatch(/^# The Machine That Breaks at Scale \{#sec-machine-breaks\}/);
  for (const phrase of [
    "failure contract",
    "workload boundary",
    "useful progress",
    "correct result",
    "not interchangeable",
  ]) expect(flat).toContain(phrase);
  expect(chapter).not.toContain("/figures/the-machine-that-breaks-1.svg");
  expect(flat).not.toContain("not five problems but one phenomenon");
});

test("failure classes are separated before they are counted", () => {
  for (const phrase of [
    "planned interruption",
    "fail-stop",
    "fail-slow",
    "silent data corruption",
    "correlated failure",
    "detection latency",
    "blast radius",
    "lost work",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("@gls-mtbf, the expected interval between failures for the whole job");
});

test("the Llama ledger is reported without turning one run into a device law", () => {
  for (const phrase of [
    "466 total interruptions",
    "47 were planned",
    "419 were unexpected",
    "58.7 percent",
    "gpu issues",
    "more than 90 percent",
    "conditional projection",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("roughly 59 percent traced to gpu or high-bandwidth-memory faults");
  expect(flat).not.toContain("statistical certainty of failure");
});

test("the aggregate hazard model states its assumptions and limits", () => {
  for (const marker of [
    "\\Lambda_{\\mathrm{job}}",
    "\\sum_{j=1}^{m}",
    "\\lambda_j",
    "R_{\\mathrm{job}}(t)",
    "e^{-\\Lambda_{\\mathrm{job}}t}",
    "M_{\\mathrm{job}}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "where:",
    "stationary",
    "independent",
    "poisson",
    "failure domain",
    "not a universal scaling law",
  ]) expect(flat).toContain(phrase);
});

test("the checkpoint model connects failures to useful time", () => {
  for (const marker of [
    "W(\\tau)",
    "\\frac{C}{\\tau}",
    "\\frac{\\tau}{2M}",
    "\\frac{D+R}{M}",
    "\\tau^*",
    "\\sqrt{2CM}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "young",
    "daly",
    "blocking checkpoint cost",
    "detection and diagnosis time",
    "recovery time",
    "small-waste approximation",
    "measure ettr directly",
  ]) expect(flat).toContain(phrase);
});

test("the worked failure budget is dependency-free and executable", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toMatch(/numpy|matplotlib|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain("Observed interruption interval: 3.09 hours");
  expect(run.stdout.toString()).toContain("Young interval: 19.3 minutes");
});

test("recovery is a verified control loop and ByteRobust stays source-scoped", () => {
  for (const phrase of [
    "detect",
    "isolate",
    "restore",
    "verify",
    "warm standby",
    "peer backup",
    "up to 97 percent",
    "9,600",
    "three-month",
    "less than 0.9 percent",
    "reported production result",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("restart costs seconds rather than the tens of minutes");
  expect(flat).not.toContain("state of the art");
});

test("silent-corruption evidence distinguishes field samples from injection models", () => {
  for (const phrase of [
    "fifteen unhealthy nodes",
    "fifteen healthy nodes",
    "single-node tensor parallelism",
    "stuck-at fault-injection simulation",
    "two-sm model",
    "63 cuda micro-benchmarks",
    "1.01 percent",
    "under 40 percent",
    "not a fleet incidence rate",
    "golden output",
    "quarantine",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("such an event is not a possibility but a near certainty");
  expect(flat).not.toContain("the model most error-correcting codes assume");
});

test("network evidence is topology-specific and DiLoCo experiments remain distinct", () => {
  for (const phrase of [
    "meta's topology",
    "same-rack traffic",
    "topology-specific",
    "synthetic event tape",
    "1.2 million chips",
    "88 percent goodput",
    "58 percent",
    "separately",
    "12b model",
    "u.s. regions",
    "not frontier-scale production",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("those multipliers are physics");
  expect(flat).not.toContain("ordinary wide-area links");
});

test("serving disaggregation is conditional and has an explicit handoff", () => {
  for (const phrase of [
    "time to first token",
    "time per output token",
    "slo goodput",
    "batch size",
    "prompt length",
    "output length",
    "kv-cache transfer",
    "distserve",
    "mooncake",
    "co-located",
    "chunked prefill",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain('data-chip="PREFILL"');
  expect(flat).not.toContain("adding flops buys nothing");
});

test("agent reliability uses the chain rule instead of treating p^n as a forecast", () => {
  for (const marker of [
    "\\Pr(S_{1:n})",
    "\\prod_{i=1}^{n}",
    "\\Pr(S_i \\mid S_{1:i-1})",
    "p^n",
    "\\operatorname{pass}^{k}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "null model",
    "self-correction",
    "self-conditioning",
    "time horizon",
    "human expert",
    "repeated trials",
    "transaction boundary",
  ]) expect(flat).toContain(phrase);
});

test("the operational evidence contract is reproducible", () => {
  for (const phrase of [
    "event taxonomy",
    "source timestamp",
    "affected ranks",
    "detection time",
    "recovery time",
    "checkpoint age",
    "first divergent step",
    "slo miss",
    "replay test",
    "fault injection",
    "acceptance criterion",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-training-at-scale",
    "@sec-accelerators-networking",
    "@sec-compute-frontier",
    "@sec-powering-ai",
    "@sec-serving-problem",
    "@sec-memory-scheduling",
    "@sec-the-harness",
    "@sec-evaluating-agents",
    "@sec-capability-horizon",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-machine-failure-contract",
    "fig-machine-budget",
    "fig-machine-recovery",
    "fig-machine-sdc",
    "fig-machine-disagg",
  ]) expect(chapter).toContain(figure);
});

test("the bibliography uses verified primary sources and corrected metadata", () => {
  for (const marker of [
    "10.1145/361147.361115",
    "10.1016/j.future.2004.11.016",
    "10.1145/3731569.3764838",
    "usenix.org/conference/osdi24/presentation/zhong-yinmin",
    "usenix.org/conference/fast25/presentation/qin",
    "arxiv.org/abs/2406.12045",
    "metr.org/time-horizons",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
  expect(bibliography).toContain("author        = {Tung, Chung-Hsuan");
  expect(bibliography).toContain("author        = {Douillard, Arthur");
  expect(bibliography).toContain("title         = {Decoupled DiLoCo for Resilient Distributed Pre-training}");

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(12);
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
    currentHref: "infrastructure/the-machine-that-breaks.html",
    chapterTitle: "The Machine That Breaks at Scale",
    chapterNum: "69",
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
  expect(html).toContain("A reliable machine is not one that never fails");
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
