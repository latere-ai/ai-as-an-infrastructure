import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/infrastructure/06-making-the-silicon.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/infrastructure/06-making-the-silicon.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/making-the-silicon.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis is product-scoped instead of declaring one universal bottleneck", () => {
  expect(chapter).toMatch(
    /^# Making the Silicon: Packaging, HBM, and the Geopolitics of Compute \{#sec-making-silicon\}/,
  );
  for (const phrase of [
    "product and time window",
    "can bind",
    "not universal",
    "bill of materials",
    "qualified shipment",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the transistor is not the bottleneck");
  expect(flat).not.toContain("all three had declared their output sold out");
});

test("a unit-safe supply ledger bounds qualified shipments", () => {
  for (const marker of [
    "N_{\\text{ship}}",
    "G_L",
    "G_H",
    "G_I",
    "G_S",
    "C_A",
    "C_T",
    "\\min",
    "W_L",
    "D_L",
    "Y_L",
  ]) expect(chapter).toContain(marker);
  expect(flat).toContain("where:");
  expect(flat).toContain("optimistic upper bound");
});

test("the worked ledger is dependency-free and finds the limiting stage", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toMatch(/numpy|matplotlib|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain("Binding stage: qualified HBM stacks");
});

test("manufacturing stages and yield boundaries are explicit", () => {
  for (const phrase of [
    "wafer starts",
    "candidate dies",
    "known-good dies",
    "wafer probe",
    "hbm stack yield",
    "interposer",
    "package substrate",
    "assembly yield",
    "final test",
    "qualification",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("wafer starts are not shipments");
});

test("reticle and HBM claims preserve scope and alternatives", () => {
  for (const phrase of [
    "reticle field",
    "conventional single-exposure die",
    "monolithic",
    "chiplets",
    "wafer-scale",
    "2,048",
    "dram dies",
    "logic base die",
    "n12",
    "n3",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("a frontier accelerator exceeds the single-reticle limit");
  expect(flat).not.toContain("same leading-edge wafers as compute");
});

test("capacity statements carry units, status, scope, and date", () => {
  for (const phrase of [
    "installed capacity",
    "available capacity",
    "committed allocation",
    "announced expansion",
    "analyst estimate",
    "vendor claim",
    "as of",
    "unit boundary",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("processed wafers");
  expect(flat).toContain("assembled packages");
});

test("geography and policy are evaluated as stage-scoped predicates", () => {
  for (const phrase of [
    "stage map",
    "alternate site",
    "qualified",
    "item parameters",
    "destination",
    "end use",
    "end user",
    "license policy",
    "case-by-case review is not approval",
    "january 15, 2026",
  ]) expect(flat).toContain(phrase);
});

test("procurement evidence is reproducible", () => {
  for (const phrase of [
    "bom revision",
    "allocation period",
    "committed and forecast",
    "yield boundary",
    "lead-time percentile",
    "alternate qualification",
    "recovery plan",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of ["@sec-compute-frontier", "@sec-powering-ai", "@sec-economics"])
    expect(chapter).toContain(ref);
  for (const figure of [
    "fig-making-silicon-ledger",
    "fig-making-silicon-flow",
    "fig-making-silicon-stage-map",
    "fig-making-silicon-evidence",
  ]) expect(chapter).toContain(figure);
});

test("the bibliography favors primary standards, vendors, and rules", () => {
  for (const marker of [
    "tsmc.com/english/dedicatedfoundry/technology/cowos",
    "pr.tsmc.com/english/news/3302",
    "pr.tsmc.com/english/news/3228",
    "news.skhynix.com/en/sk-hynix-completes-worlds-first-hbm4",
    "federalregister.gov/documents/2026/01/15/2026-00789",
  ]) expect(bibliography.toLowerCase()).toContain(marker);

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(6);
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

test("the complete chapter renders without swallowing diagrams or late prose", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "infrastructure/making-the-silicon.html",
    chapterTitle: "Making the Silicon: Packaging, HBM, and the Geopolitics of Compute",
    chapterNum: "67",
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
  expect(html).toContain("The durable skill is to reconcile evidence at one unit boundary");
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
