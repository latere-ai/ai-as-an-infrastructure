import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/12-production-data-engine.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/production-data-engine.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter defines a governed evidence pipeline rather than a traffic harvester", () => {
  expect(chapter).toMatch(
    /^# The Production Data Engine \{#sec-data-engine\}/,
  );
  for (const phrase of [
    "governed evidence pipeline",
    "declared purpose",
    "sensitive liability",
    "not automatically a label",
    "production data release record",
  ]) expect(flat).toContain(phrase);
});

test("the intake contract carries identity, versions, authority, and lifecycle", () => {
  for (const phrase of [
    "event identity",
    "subject and tenant",
    "task version",
    "model release",
    "prompt version",
    "retrieval version",
    "tool version",
    "policy version",
    "interface version",
    "allowed downstream uses",
    "retention",
    "deletion lineage",
    "inclusion probability",
    "outcome delay",
  ]) expect(flat).toContain(phrase);
});

test("observations, annotations, labels, and data products remain distinct", () => {
  for (const phrase of [
    "behavioral event",
    "observation",
    "annotation",
    "adjudicated label",
    "data product",
    "agreement is not truth",
  ]) expect(flat).toContain(phrase);
});

test("sampling is separated by purpose", () => {
  for (const phrase of [
    "representative monitoring",
    "diagnostic discovery",
    "training acquisition",
    "incident intake",
    "do not mix",
    "population estimate",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("random sampling wastes the budget");
});

test("unequal probability monitoring defines and uses its weights", () => {
  for (const marker of ["\\widehat{\\mu}", "\\pi_i", "y_i", "i \\in s"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "eligible population",
    "inclusion probability",
    "inverse-probability",
    "positive chance",
  ]) expect(flat).toContain(phrase);
});

test("active learning and weak supervision retain their limits", () => {
  for (const phrase of [
    "uncertainty can be miscalibrated",
    "not a representative sample",
    "consensus can be wrong",
    "labeling-function dependencies",
    "held-out human audit",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("low self-consistency score, stands in for");
});

test("annotation is operated as a quality and capacity system", () => {
  for (const phrase of [
    "task specification",
    "annotator qualification",
    "calibration set",
    "blind relabel",
    "adjudication",
    "queue age",
    "service-level objective",
    "reviewer fatigue",
    "escalation path",
  ]) expect(flat).toContain(phrase);
});

test("machine judgments are versioned annotations rather than truth", () => {
  for (const phrase of [
    "judge model",
    "judge prompt",
    "expert calibration",
    "disagreement",
    "abstention",
    "machine annotation",
    "not ground truth",
  ]) expect(flat).toContain(phrase);
});

test("collection is minimized before storage and rights propagate", () => {
  for (const phrase of [
    "before storage",
    "data minimization",
    "use authorization",
    "access control",
    "raw event",
    "derived feature",
    "label",
    "evaluation case",
    "training artifact",
    "deletion request",
  ]) expect(flat).toContain(phrase);
});

test("stable partitions prevent train-evaluation contamination", () => {
  for (const phrase of [
    "before inspecting content",
    "stable assignment",
    "monitoring and audit",
    "regression evaluation",
    "training and weak supervision",
    "quarantine",
    "split collision",
    "adaptive leakage",
  ]) expect(flat).toContain(phrase);
});

test("production failures are sanitized and qualified before promotion", () => {
  for (const phrase of [
    "sanitize",
    "reproduce",
    "adjudicate",
    "freeze expected behavior",
    "provenance",
    "version context",
    "stale test",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("can never silently regress");
});

test("feedback effects require exposure records and causal evaluation", () => {
  for (const phrase of [
    "performative",
    "exposure",
    "propensity",
    "policy version",
    "randomized holdout",
    "counterfactual",
    "before-and-after",
    "does not establish causality",
  ]) expect(flat).toContain(phrase);
});

test("the runnable partition example is deterministic and self-checking", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  for (const phrase of [
    "def stable_partition",
    "hashlib.sha256",
    "purpose",
    "assert",
  ]) expect(cell![1]).toContain(phrase);
  expect(cell![1]).not.toContain("import numpy");
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
});

test("release gates and scenario tests close the data lifecycle", () => {
  for (const phrase of [
    "immutable manifest",
    "schema drift",
    "duplicate event",
    "missing use authorization",
    "stale outcome",
    "sampler outage",
    "labeler drift",
    "judge version change",
    "poisoned feedback",
    "production data release record",
  ]) expect(flat).toContain(phrase);
});

test("stable interfaces remain while machine-like absolutes disappear", () => {
  for (const marker of [
    "#sec-data-engine",
    "fig-data-engine-loop",
    "@sec-human-interface-oversight",
    "@sec-data-curation",
    "@sec-synthetic-data",
    "@sec-deployment-lifecycle",
    "@sec-privacy-provenance",
    "## Constraint Arrow",
    "::: {#further-reading}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "one thing its next model most needs",
    "that last part is the asset",
    "the labelers are the model",
    "the model is only as good",
  ]) expect(flat).not.toContain(phrase);
});

test("citations and bibliography remain mechanically owned", () => {
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

test("the complete chapter renders through its release record", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/production-data-engine.html",
    chapterTitle: "The Production Data Engine",
    chapterNum: "92",
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
  expect(html).toContain("production data release record");
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("the evidence-pipeline Graphviz parses and fits a mobile column", async () => {
  const block = chapter.match(
    /```\{dot\}\n([\s\S]*?label: fig-data-engine-loop[\s\S]*?)\n```/,
  );
  expect(block).toBeDefined();
  expect(block![1]).toContain("rankdir=TB");
  const graphviz = await loadGraphviz();
  const svg = renderDot(
    graphviz,
    block![1],
    new Map(),
    "practice/production-data-engine.html",
    "",
  );
  expect(svg).not.toContain("graphviz error");
  const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
});
