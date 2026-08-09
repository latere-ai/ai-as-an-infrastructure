import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/ecosystem/06-adoption-productivity.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/ecosystem/06-adoption-productivity.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/adoption-productivity.bib", import.meta.url),
  "utf8",
);
const vizRuntime = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis defines adoption relative to work and a counterfactual", () => {
  expect(chapter).toMatch(/^# Adoption and Productivity \{#sec-adoption-productivity\}/);
  for (const phrase of [
    "accepted unit of work",
    "counterfactual",
    "task",
    "worker",
    "workflow",
    "tool version",
    "review policy",
    "time window",
  ]) expect(flat).toContain(phrase);
});

test("productivity is reported as a decision vector rather than one proxy", () => {
  for (const phrase of [
    "accepted throughput",
    "cycle time",
    "quality",
    "review time",
    "rework",
    "escalation",
    "incident",
    "worker experience",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("tokens generated");
  expect(flat).toContain("not productivity");
});

test("the pilot estimand separates assignment from voluntary use", () => {
  for (const marker of ["\\widehat{\\tau}_{\\mathrm{ITT}}", "Z_i", "Y_i"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "intent-to-treat",
    "random assignment",
    "actual use",
    "noncompliance",
    "selection bias",
    "unit of randomization",
  ]) expect(flat).toContain(phrase);
});

test("coordination and spillovers are part of the experimental design", () => {
  for (const phrase of [
    "spillover",
    "cluster-randomize",
    "coordination",
    "shared queue",
    "meeting",
  ]) expect(flat).toContain(phrase);
});

test("the adoption ledger uses one accounting period and compatible units", () => {
  for (const marker of [
    "NB_H",
    "R_1-R_0",
    "C_0-C_1",
    "C_{\\mathrm{fixed}}",
    "\\mathbb{E}[L_1-L_0]",
  ]) expect(chapter.replace(/\s+/g, "")).toContain(marker);
  for (const phrase of [
    "accounting horizon",
    "same currency",
    "baseline arm",
    "assisted arm",
    "amortized",
    "uncertainty interval",
  ]) expect(flat).toContain(phrase);
});

test("the ROI explorer no longer adds raw time and quality percentages", () => {
  expect(chapter).toContain('data-viz="roi-balance"');
  expect(flat).toContain("illustrative normalized value units");
  expect(vizRuntime).not.toContain("base * (time / 100 + quality / 100)");
  expect(vizRuntime).not.toContain("time: 'time saved (%)'");
  for (const phrase of [
    "capacity benefit",
    "quality / revenue benefit",
    "fixed adoption cost",
    "expected incident loss",
  ]) expect(vizRuntime.toLowerCase()).toContain(phrase);
});

test("the ROI explorer keeps row labels outside its diverging bars", () => {
  expect(vizRuntime).not.toContain("fillText(r.label, zero");
  for (const marker of ["var rowH = 42", "var barY = y + 18", "ctx.textAlign = 'left'", "ctx.textAlign = 'right'"])
    expect(vizRuntime).toContain(marker);
});

test("the productivity J-curve explains complementary investment", () => {
  for (const phrase of [
    "productivity j-curve",
    "complementary investment",
    "business-process redesign",
    "intangible capital",
    "measurement lag",
  ]) expect(flat).toContain(phrase);
});

test("the jagged-frontier evidence retains its experimental boundary", () => {
  for (const phrase of [
    "758 consultants",
    "two task bundles",
    "12.2 percent more tasks",
    "25.1 percent faster",
    "19 percentage points",
    "does not define a permanent frontier",
  ]) expect(flat).toContain(phrase);
  expect(chapter).not.toContain("adoption-productivity-1.svg");
});

test("field results preserve population treatment outcome and scope", () => {
  for (const phrase of [
    "5,172 customer-support agents",
    "15 percent",
    "single firm",
    "7,137 workers",
    "1.4 fewer hours",
    "2.0 fewer hours",
    "meeting time",
    "16 developers",
    "246 tasks",
    "19 percent",
    "2 to 39 percent",
    "early-2025 tools",
  ]) expect(flat).toContain(phrase);
});

test("current broad evidence separates work reorganization from aggregate outcomes", () => {
  for (const phrase of [
    "denmark",
    "recorded hours",
    "earnings",
    "larger than 2 percent",
    "task reorganization",
    "two years",
  ]) expect(flat).toContain(phrase);
});

test("usage logs and capability benchmarks are not called productivity evidence", () => {
  for (const phrase of [
    "usage logs",
    "self-selected",
    "gdpval",
    "isolated deliverable",
    "neither establishes causal productivity",
    "organizational return",
    "18 percent of u.s. firms",
    "three functions",
  ]) expect(flat).toContain(phrase);
});

test("the operating pilot has gates from definition through decision", () => {
  for (const phrase of [
    "freeze the unit",
    "register the design",
    "instrument both arms",
    "apply the acceptance rule",
    "estimate effects",
    "price the ledger",
    "make a bounded decision",
    "rollback",
  ]) expect(flat).toContain(phrase);
});

test("stable interfaces contested questions and handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-market-structure",
    "@sec-economics",
    "@sec-statistical-reliability",
    "@sec-data-rights-economics",
  ]) expect(chapter).toContain(ref);
  expect(chapter).toContain("fig-adoption-pilot");
});

test("hard wraps do not split hyphenated compounds", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("the bibliography favors published and archival primary evidence", () => {
  for (const marker of [
    "doi.org/10.1257/mac.20180386",
    "doi.org/10.1126/science.adh2586",
    "doi.org/10.1287/orsc.2025.21838",
    "doi.org/10.1093/qje/qjae044",
    "aeaweb.org/articles?id=10.1257/aeri.20250275",
    "arxiv.org/abs/2507.09089",
    "nber.org/papers/w33777",
    "arxiv.org/abs/2503.04761",
    "arxiv.org/abs/2510.04374",
    "census.gov/library/working-papers/2026/adrm/ces-wp-26-25.html",
  ]) expect(bibliography.toLowerCase()).toContain(marker);

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(9);
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
    currentHref: "ecosystem/adoption-productivity.html",
    chapterTitle: "Adoption and Productivity",
    chapterNum: "78",
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
  expect(html).toContain("Capability is potential. Productivity is a measured change in accepted work");
  expect(html.match(/<figure/g)?.length).toBe(2);
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(1);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
