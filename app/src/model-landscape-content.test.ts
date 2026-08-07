import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/ecosystem/01-model-landscape.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/ecosystem/01-model-landscape.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/model-landscape.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis treats a model release as a contract rather than one openness score", () => {
  expect(chapter).toMatch(/^# The Model Landscape \{#sec-model-landscape\}/);
  for (const phrase of [
    "a model name is not a deployment option",
    "release contract",
    "artifact access",
    "legal permission",
    "operational access",
    "evidence quality",
    "independent questions",
    "not a single open-to-closed score",
    "snapshot date",
  ]) expect(flat).toContain(phrase);
  expect(chapter).not.toContain("/figures/model-landscape-1.svg");
  expect(chapter).not.toContain("/figures/model-landscape-2.svg");
});

test("the vocabulary separates systems, models, weights, services, and source claims", () => {
  for (const phrase of [
    "ai system",
    "model architecture",
    "learned parameters",
    "inference code",
    "hosted service",
    "open weights",
    "open source ai",
    "data information",
    "substantially equivalent system",
    "does not require publication of every training example",
  ]) expect(flat).toContain(phrase);
});

test("the release profile is formal, versioned, and rejects unknown hard requirements", () => {
  for (const marker of [
    "R_r(v,t)",
    "A_r",
    "X_r",
    "P_r",
    "O_r",
    "E_r",
    "\\operatorname{eligible}(r,Q)",
    "\\bigwedge_{q\\in Q}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "release under review",
    "version identifier",
    "observation date",
    "hard deployment requirements",
    "documented evidence",
    "unknown does not satisfy a release gate",
    "not an openness metric",
  ]) expect(flat).toContain(phrase);
});

test("artifact availability is separated from reproducibility and auditability", () => {
  for (const phrase of [
    "final weights",
    "architecture and tokenizer",
    "inference code",
    "training code and configuration",
    "training-data information",
    "training data",
    "intermediate checkpoints",
    "optimizer state",
    "data order",
    "run telemetry",
    "repeat the published run",
    "independent replication",
    "model card",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("trust belongs to the fully open tier alone");
});

test("license and service reviews expose the terms practitioners must inspect", () => {
  for (const phrase of [
    "copyright grant",
    "patent grant",
    "redistribution",
    "use restrictions",
    "derivative model",
    "attribution",
    "trademark",
    "termination",
    "acceptable-use policy",
    "data retention",
    "training on customer data",
    "region availability",
    "rate limits",
    "version pinning",
    "deprecation",
    "service-level agreement",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("not legal advice");
  expect(flat).not.toContain("depending only on the license text");
});

test("dated release examples state evidence without assigning permanent tiers", () => {
  for (const phrase of [
    "7 august 2026",
    "pythia",
    "154 checkpoints",
    "same data order",
    "olmo 2",
    "llama 3",
    "qwen3",
    "deepseek-v3",
    "gpt-oss",
    "apache 2.0",
    "gemma",
    "custom terms",
    "gpt-4 technical report",
    "does not disclose",
    "release-specific",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the open-weights frontier is now carried largely");
  expect(flat).not.toContain("meta reorganized its ai effort");
});

test("public method records are described without claiming openness caused or originated them", () => {
  for (const phrase of [
    "public evidence base",
    "cannot establish who used a method first",
    "does not show that a technique originated",
    "deepseek-v3",
    "fp8",
    "auxiliary-loss-free",
    "multi-token prediction",
    "deepseek-v2",
    "multi-head latent attention",
    "grouped-query attention",
    "compute-optimal training",
    "inference-aware",
    "zero-shot hyperparameter transfer",
    "warmup-stable-decay",
    "3d parallelism",
    "frequent checkpointing",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("almost every technique now in common use");
  expect(flat).not.toContain("nearly every recipe that lowers the cost of a token");
});

test("the practitioner ledger turns the framework into a release decision", () => {
  for (const phrase of [
    "exact model and revision",
    "artifact hashes",
    "license version",
    "terms version",
    "required permissions",
    "provenance evidence",
    "evaluation scope",
    "hosting dependencies",
    "exit test",
    "owner",
    "review date",
    "expiry trigger",
    "eligible",
    "ineligible",
    "unresolved",
  ]) expect(flat).toContain(phrase);
});

test("the runnable evaluates hard requirements without converting them to a weighted score", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toMatch(/numpy|matplotlib|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain("local-private: eligible");
  expect(run.stdout.toString()).toContain("regulated-audit: unresolved (training_data_provenance)");
  expect(run.stdout.toString()).toContain("redistributable-product: ineligible (redistribution)");
});

test("stable cross-layer handoffs and contested questions remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-model-artifacts",
    "@sec-economics",
    "@sec-data-rights-economics",
    "@sec-choosing-model",
    "@sec-deployment-lifecycle",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-release-contract",
    "fig-artifact-evidence",
    "fig-permission-service",
    "fig-release-gate",
  ]) expect(chapter).toContain(figure);
});

test("hard wraps do not split hyphenated compounds in rendered prose", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("the bibliography uses authoritative and archival records", () => {
  for (const marker of [
    "opensource.org/ai/open-source-ai-definition",
    "proceedings.mlr.press/v202/biderman23a.html",
    "10.1145/3287560.3287596",
    "github.com/openai/gpt-oss",
    "ai.google.dev/gemma/terms",
    "cdn.openai.com/papers/gpt-4.pdf",
  ]) expect(bibliography.toLowerCase()).toContain(marker);

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
    currentHref: "ecosystem/model-landscape.html",
    chapterTitle: "The Model Landscape",
    chapterNum: "73",
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
  expect(html).toContain("The decision is release-specific");
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
