import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/infrastructure/05-the-compute-frontier.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/infrastructure/05-the-compute-frontier.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/the-compute-frontier.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis names a workload and boundary instead of declaring one universal wall", () => {
  expect(chapter).toMatch(/^# The Compute Frontier: Bandwidth, Not FLOPs \{#sec-compute-frontier\}/);
  for (const phrase of [
    "scarce resource is bytes rather than arithmetic",
    "workload",
    "memory boundary",
    "measured traffic",
    "not universal",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the spec-sheet flops was never the scarce resource");
});

test("a multi-boundary lower bound makes the bottleneck claim falsifiable", () => {
  for (const marker of [
    "T_{\\text{step}}",
    "Q_{\\text{HBM}}",
    "B_{\\text{HBM}}",
    "Q_{\\text{up}}",
    "B_{\\text{up}}",
    "Q_{\\text{out}}",
    "B_{\\text{out}}",
    "P_{\\text{eff}}",
  ]) expect(chapter).toContain(marker);
  expect(chapter).toContain("\\max");
  expect(flat).toContain("where:");
  expect(flat).toContain("overlap");
});

test("the worked model is dependency-free and identifies the limiting term", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toMatch(/numpy|matplotlib|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain("Binding term: HBM traffic");
});

test("the rewrite removes the invented trend chart and roadmap arithmetic", () => {
  expect(chapter).not.toContain("/figures/the-compute-frontier-1.svg");
  for (const phrase of [
    "idealized relative growth",
    "nine-reticle super carrier",
    "path past fourteen reticles",
    "already shipping rather than promised",
  ]) expect(flat).not.toContain(phrase);
});

test("the package section separates die, interposer, substrate, and memory", () => {
  for (const phrase of [
    "reticle field",
    "yield",
    "chiplet",
    "interposer",
    "package substrate",
    "hbm stack",
    "@gls-cowos package: an advanced package that places compute chiplets and hbm",
  ]) expect(flat).toContain(phrase);
});

test("memory claims distinguish capacity, bandwidth, traffic, and energy", () => {
  for (const phrase of [
    "memory capacity",
    "sustainable bandwidth",
    "traffic volume",
    "energy per bit",
    "2,048-bit",
    "base die",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("any specific figure in this chapter is a date stamp");
});

test("scale-up and scale-out are product-scoped locality domains", () => {
  for (const phrase of [
    "scale-up domain",
    "scale-out fabric",
    "72-gpu nvlink domain",
    "logical topology",
    "failure domain",
    "does not make 72 gpus one device",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("one nvlink-coherent domain");
  expect(flat).not.toContain("tensor parallelism stays inside the nvlink domain");
  expect(flat).not.toContain("only sparse communication can afford");
});

test("parallelism placement follows measured traffic rather than acronyms", () => {
  for (const phrase of [
    "tensor parallel",
    "expert parallel",
    "pipeline parallel",
    "data parallel",
    "collective",
    "placement",
    "contention",
  ]) expect(flat).toContain(phrase);
});

test("technology status is explicit and dated", () => {
  for (const phrase of ["available system", "announced product", "research prototype", "as of"])
    expect(flat).toContain(phrase);
  for (const phrase of ["cloudmatrix 384", "atlas 950", "rubin cpx", "tom's hardware"])
    expect(flat).not.toContain(phrase);
});

test("escape routes state which term they change and what they cost", () => {
  for (const phrase of [
    "reduce traffic",
    "increase locality",
    "increase sustainable bandwidth",
    "distribute state",
    "numerical quality",
    "conversion overhead",
    "serviceability",
  ]) expect(flat).toContain(phrase);
});

test("prefill and decode remain conditional workload phases", () => {
  for (const phrase of [
    "prefill",
    "decode",
    "batch size",
    "sequence length",
    "kv cache",
    "phase boundary",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("prefill, the processing of a long prompt, is compute-bound");
});

test("hardware comparisons use a reproducible operating contract", () => {
  for (const phrase of [
    "model and operation",
    "tensor shape",
    "precision",
    "software version",
    "topology",
    "sustained bandwidth",
    "power boundary",
    "availability",
    "failure behavior",
    "cost",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-accelerators-networking",
    "@sec-memory-scheduling",
    "@sec-quantization-kernels",
    "@sec-making-silicon",
    "@sec-powering-ai",
    "@sec-machine-breaks",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-compute-frontier-bounds",
    "fig-compute-frontier-package",
    "fig-compute-frontier-domain",
    "fig-compute-frontier-escape-map",
  ]) expect(chapter).toContain(figure);
});

test("the bibliography favors primary work and official specifications", () => {
  for (const marker of [
    "10.1145/1498765.1498785",
    "tsmc.com/english/dedicatedfoundry/technology/cowos",
    "docs.nvidia.com/dgx/dgxgb200-user-guide",
    "ualinkconsortium.org/specification",
    "10.1049/ote2.12020",
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
    currentHref: "infrastructure/the-compute-frontier.html",
    chapterTitle: "The Compute Frontier: Bandwidth, Not FLOPs",
    chapterNum: "66",
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
  expect(html).toContain("The durable skill is to locate the active boundary");
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
