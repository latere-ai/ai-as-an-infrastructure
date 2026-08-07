import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/04-training-finetuning-practice.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/training-finetuning-practice.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter starts from a measurable adaptation contract", () => {
  expect(chapter).toMatch(
    /^# Training and Fine-tuning in Practice \{#sec-training-practice\}/,
  );
  for (const phrase of [
    "adaptation contract",
    "target behavior",
    "frozen baseline",
    "no-change requirements",
    "deployment target",
    "budget ceiling",
    "promotion gate",
    "rollback",
    "adaptation decision record",
  ]) expect(flat).toContain(phrase);
});

test("the train-or-not gate compares weight changes with cheaper controls", () => {
  for (const phrase of [
    "same evaluation set",
    "prompt",
    "retrieval",
    "tool schema",
    "structured decoder",
    "durable behavior",
    "must live in the weights",
    "do not train",
  ]) expect(flat).toContain(phrase);
});

test("the data pipeline preserves rights, lineage, and split integrity", () => {
  for (const phrase of [
    "data provenance",
    "license",
    "consent",
    "source id",
    "grouping unit",
    "deduplicate",
    "across splits",
    "test quarantine",
    "chat template",
    "assistant-only loss",
    "personally identifiable information",
    "secrets",
    "deletion",
  ]) expect(flat).toContain(phrase);
});

test("training objectives are selected from the supervision that exists", () => {
  for (const phrase of [
    "supervised fine-tuning",
    "demonstrations",
    "chosen and rejected",
    "direct preference optimization",
    "reward can be gamed",
    "continued pretraining",
    "domain distribution",
    "distillation",
    "teacher",
    "student",
  ]) expect(flat).toContain(phrase);
});

test("the SFT objective defines the loss mask and every symbol", () => {
  for (const marker of [
    "\\mathcal{L}_{\\mathrm{SFT}}",
    "$N$",
    "$\\theta$",
    "m_{i,t}",
    "p_{\\theta}",
    "x_i",
    "y_{i,<t}",
  ]) expect(chapter).toContain(marker);
  expect(chapter).not.toContain("\t");
  for (const phrase of [
    "loss mask",
    "assistant answer tokens",
    "number of examples",
    "trainable parameters",
  ]) expect(flat).toContain(phrase);
});

test("math uses delimiters supported by the book renderer", () => {
  for (const delimiter of ["\\(", "\\)", "\\[", "\\]"])
    expect(chapter).not.toContain(delimiter);
});

test("parameter scope is explained without invented data thresholds", () => {
  for (const marker of [
    "\\Delta W = BA",
    "r(d_{\\mathrm{in}} + d_{\\mathrm{out}})",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "frozen quantized base",
    "adapter rank",
    "target modules",
    "full fine-tuning",
    "empirical comparison",
  ]) expect(flat).toContain(phrase);
  for (const phrase of ["1k to 50k", "50k to 500k", "500k or more examples"])
    expect(flat).not.toContain(phrase);
});

test("run sizing includes the complete memory and cost envelopes", () => {
  for (const marker of [
    "M_{\\mathrm{peak}}",
    "M_{\\mathrm{params}}",
    "M_{\\mathrm{grads}}",
    "M_{\\mathrm{opt}}",
    "M_{\\mathrm{acts}}",
    "M_{\\mathrm{workspace}}",
    "C_{\\mathrm{adapt}}",
    "V^*",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "activation checkpointing",
    "sharded",
    "data preparation",
    "evaluation",
    "engineering",
    "deployment",
    "equivalent quality",
  ]) expect(flat).toContain(phrase);
});

test("tools are selected by capabilities instead of volatile rankings", () => {
  for (const phrase of [
    "capability matrix",
    "official support matrix",
    "checkpoint portability",
    "exportability",
    "data residency",
    "preemption",
    "resume test",
  ]) expect(flat).toContain(phrase);
  for (const phrase of [
    "default: axolotl",
    "pick unsloth when",
    "de-facto standard",
    "68k github stars",
    "$800m arr",
  ]) expect(flat).not.toContain(phrase);
});

test("a run manifest makes the experiment reproducible", () => {
  for (const phrase of [
    "run manifest",
    "base checkpoint digest",
    "tokenizer revision",
    "dataset manifest",
    "split rule",
    "container digest",
    "random seed",
    "optimizer",
    "scheduler",
    "checkpoint interval",
    "code revision",
  ]) expect(flat).toContain(phrase);
});

test("promotion evaluates the change rather than trusting training loss", () => {
  for (const phrase of [
    "training loss is not a release metric",
    "target-task",
    "retention",
    "safety",
    "memorization",
    "operational",
    "slice",
    "seed",
    "confidence interval",
    "paired",
    "failure budget",
  ]) expect(flat).toContain(phrase);
});

test("the released artifact is complete, comparable, and reversible", () => {
  for (const phrase of [
    "base model digest",
    "adapter digest",
    "tokenizer",
    "prompt template",
    "license",
    "merge parity",
    "serving runtime",
    "staged rollout",
    "last-known-good",
    "rollback trigger",
  ]) expect(flat).toContain(phrase);
});

test("RL wiring accounts for rollout generation and policy freshness", () => {
  for (const phrase of [
    "rollout generator",
    "training workers",
    "weight version",
    "policy staleness",
    "colocated",
    "disaggregated",
    "@sec-training-agents",
  ]) expect(flat).toContain(phrase);
});

test("the operating procedure closes the loop and names requalification", () => {
  for (const phrase of [
    "freeze the contract",
    "quarantine the test set",
    "smallest viable pilot",
    "promotion report",
    "canary",
    "requalification trigger",
    "base-model change",
    "template change",
    "runtime change",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite is durable and retains the chapter interfaces", () => {
  for (const phrase of [
    "mid-2026",
    "revenue figures",
    "github star counts",
    "fine-tuning is a serving-cost decision wearing a training costume",
    "uncertain, status evolving",
  ]) expect(flat).not.toContain(phrase);
  for (const marker of [
    "fig-training-layers",
    "fig-training-finetuning-practice-cost-crossover",
    "fig-training-wiring",
    "@sec-sft-peft",
    "@sec-training-at-scale",
    "@sec-serving-stack",
    "@sec-eval-practice",
    "@sec-training-agents",
    "@sec-deployment-lifecycle",
    "::: {#further-reading}",
  ]) expect(chapter).toContain(marker);
});

test("the bibliography prioritizes primary methods and operating evidence", () => {
  for (const value of [
    "Low-Rank Adaptation of Large Language Models",
    "QLoRA: Efficient Finetuning of Quantized LLMs",
    "DoRA: Weight-Decomposed Low-Rank Adaptation",
    "Direct Preference Optimization",
    "Deduplicating Training Data Makes Language Models Better",
    "The Secret Sharer",
    "Model Cards for Model Reporting",
    "Data Cards",
    "ZeRO: Memory Optimizations",
    "HybridFlow",
  ]) expect(bibliography).toContain(value);
});

test("the runnable cost model executes without optional plotting packages", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(run.stdout);
  const stderr = new TextDecoder().decode(run.stderr);
  expect(run.exitCode, stderr).toBe(0);
  expect(stdout).toContain("break-even volume: 11.1M accepted tokens");
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("matplotlib");
});

test("hard wraps do not split hyphenated compounds", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("every inline citation is owned by the chapter bibliography", () => {
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

test("the complete chapter renders through its operating handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/training-finetuning-practice.html",
    chapterTitle: "Training and Fine-tuning in Practice",
    chapterNum: "84",
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
  expect(html.match(/class="katex-display"/g)?.length).toBe(8);
  expect(html).toContain("The output is an adaptation decision record");
  expect(headings.some(({ text }) => text.includes("\\mathcal"))).toBeFalse();
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
