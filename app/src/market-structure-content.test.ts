import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/ecosystem/05-market-structure.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/ecosystem/05-market-structure.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/market-structure.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis treats the value chain as linked markets and dependencies", () => {
  expect(chapter).toMatch(/^# The AI Value Chain \{#sec-market-structure\}/);
  for (const phrase of [
    "model call looks like a software service",
    "industrial chain",
    "dependency graph",
    "not one market",
    "accepted outcome",
    "outside options",
  ]) expect(flat).toContain(phrase);
});

test("market definition precedes concentration measurement", () => {
  for (const marker of ["\\mathcal{M}", "(P,G,T,U,Q)"]) {
    expect(chapter.replace(/\s+/g, "")).toContain(marker);
  }
  for (const phrase of [
    "product or service",
    "geography",
    "time window",
    "customer group",
    "quality and service threshold",
    "reasonable substitute",
  ]) expect(flat).toContain(phrase);
});

test("the chapter distinguishes a dependency from a control point", () => {
  for (const phrase of [
    "control point",
    "scarce or hard-to-replace input",
    "ability and incentive",
    "outside option",
    "bottleneck",
    "does not by itself prove market power",
  ]) expect(flat).toContain(phrase);
});

test("concentration has a complete and bounded HHI formulation", () => {
  for (const marker of [
    "\\operatorname{HHI}",
    "10{,}000",
    "\\sum_{i=1}^{n}",
    "s_i^2",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "share of supplier",
    "sum to one",
    "screening statistic",
    "not a finding of market power",
    "market boundary",
    "share metric",
  ]) expect(flat).toContain(phrase);
});

test("the runnable demonstrates market-definition sensitivity without dependencies", () => {
  const cells = [...chapter.matchAll(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/g)];
  expect(cells.length).toBe(1);
  expect(cells[0][1]).not.toMatch(/numpy|torch|requests|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cells[0][1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toBe(
    "narrow: suppliers=4 hhi=3250 effective-firms=3.08\n" +
      "broader: suppliers=5 hhi=2250 effective-firms=4.44\n" +
      "equal-five: suppliers=5 hhi=2000 effective-firms=5.00\n",
  );
});

test("switching cost is measured as an exit exercise", () => {
  for (const marker of [
    "C_{\\mathrm{switch}}",
    "C_{\\mathrm{export}}",
    "C_{\\mathrm{rewrite}}",
    "C_{\\mathrm{retest}}",
    "C_{\\mathrm{parallel}}",
    "C_{\\mathrm{exit}}",
    "\\mathbb{E}[C_{\\mathrm{failure}}]",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "migration drill",
    "time to restore service",
    "data egress",
    "rollback",
    "switching cost is directional",
  ]) expect(flat).toContain(phrase);
});

test("vertical integration is presented with both mechanisms and evidence limits", () => {
  for (const phrase of [
    "vertical integration",
    "lower coordination cost",
    "preferential access",
    "foreclosure",
    "does not make every integration anticompetitive",
    "alphabet, amazon, and microsoft",
    "anthropic and openai",
    "sensitive technical and business information",
  ]) expect(flat).toContain(phrase);
});

test("openness and transparency claims retain their actual scope", () => {
  for (const phrase of [
    "available weights are not the same as open source ai",
    "use, study, modify, and share",
    "license",
    "runtime",
    "evaluation contract",
    "capacity",
    "indicator set changed",
    "not a clean like-for-like time series",
  ]) expect(flat).toContain(phrase);
});

test("prices, revenues, costs, and profit are not conflated", () => {
  for (const phrase of [
    "listed price is not production cost",
    "revenue is not gross profit",
    "gross profit is not economic rent",
    "allocation rule",
    "audited segment",
  ]) expect(flat).toContain(phrase);
});

test("the operating workflow produces a refreshable market record", () => {
  for (const phrase of [
    "define the decision",
    "freeze the market boundary",
    "enumerate suppliers",
    "measure more than one share proxy",
    "test matched alternatives",
    "map dependencies and rights",
    "exercise migration",
    "set review triggers",
    "refresh the record",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes invented pressure scores and unsupported profit pools", () => {
  expect(chapter).not.toContain("market-structure-1.svg");
  for (const phrase of [
    "linear in its constraints",
    "measured profit pools confirm it",
    "roughly four fifths",
    "same $f$, $mc$, $s$ condition reading out as dollars",
    "chip the model runs on earns more of a token's profit",
    "the clock is slow",
    "who wins ai",
  ]) expect(flat).not.toContain(phrase);
});

test("stable chapter interfaces and handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-economics",
    "@sec-powering-ai",
    "@sec-data-rights-economics",
    "@sec-adoption-productivity",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-market-structure-chain",
    "fig-market-structure-audit",
  ]) expect(chapter).toContain(figure);
});

test("hard wraps do not split hyphenated compounds", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("the bibliography favors official and archival evidence", () => {
  for (const marker of [
    "fraser.stlouisfed.org",
    "justice.gov/atr/merger-guidelines",
    "doi.org/10.1787/623d1874-en",
    "ftc.gov/reports/ftc-staff-report-ai-partnerships-investments-6b-study",
    "gov.uk/government/publications/ai-foundation-models-update-paper",
    "doi.org/10.1093/epolic/eiae057",
    "arxiv.org/abs/2403.07918",
    "opensource.org/ai/open-source-ai-definition",
    "arxiv.org/abs/2512.10169",
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
    currentHref: "ecosystem/market-structure.html",
    chapterTitle: "The AI Value Chain",
    chapterNum: "77",
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
  expect(html).toContain("Bargaining power lives where credible alternatives end");
  expect(html.match(/<figure/g)?.length).toBe(2);
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
