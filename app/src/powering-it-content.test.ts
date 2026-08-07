import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/infrastructure/07-powering-it.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/infrastructure/07-powering-it.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/powering-it.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis is site- and schedule-scoped", () => {
  expect(chapter).toMatch(
    /^# Powering It: Time-to-Power as the Binding Constraint \{#sec-powering-ai\}/,
  );
  for (const phrase of [
    "not generation capacity but time-to-power",
    "self-generates rather than waits for the grid",
    "liquid cooling as the default",
    "grid operator must actively manage",
    "deliverable megawatts",
    "site, product, and date",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the megawatt, not the gpu, now sets the schedule");
});

test("a dependency graph replaces the serialized-queue shortcut", () => {
  for (const marker of [
    "T_{\\mathrm{ready}}",
    "\\max_{p \\in \\mathcal{P}}",
    "\\sum_{a \\in p}",
    "D_a",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "where:",
    "dependency path",
    "critical path",
    "p50",
    "p90",
    "percentiles cannot be added mechanically",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("three lead-time queues sit in series");
});

test("the worked critical path is dependency-free and executable", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toMatch(/numpy|matplotlib|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain("Critical path: interconnection -> substation -> commissioning");
});

test("the power ledger keeps electrical and thermal limits unit-safe", () => {
  for (const marker of [
    "P_{\\mathrm{IT,max}}(t)",
    "P_{\\mathrm{source}}(t)",
    "P_{\\mathrm{sub}}(t)",
    "P_{\\mathrm{dist}}(t)",
    "Q_{\\mathrm{cool}}(t)",
    "\\operatorname{PUE}(t)",
    "N_{\\mathrm{rack}}",
    "P_{\\mathrm{rack}}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "same contingency",
    "same averaging interval",
    "net firm real power",
    "rack nameplate",
    "measured coincident draw",
    "design redundancy",
  ]) expect(flat).toContain(phrase);
});

test("queue evidence distinguishes proposals from delivered power", () => {
  for (const phrase of [
    "generator interconnection queue",
    "large-load request",
    "not a delivery forecast",
    "double counting",
    "site control",
    "study",
    "signed agreement",
    "approval to energize",
    "observed energized load",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the active interconnection queue holds on the order of two thousand gigawatts");
});

test("behind-the-meter supply is reported by evidence status", () => {
  for (const phrase of [
    "announcement",
    "contract",
    "permit or license",
    "financing",
    "construction",
    "commissioning",
    "operation",
    "fuel delivery",
    "emissions permits",
    "backup service",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("safstor");
  expect(flat).toContain("august 7, 2026");
});

test("cooling claims stay product- and facility-specific", () => {
  for (const phrase of [
    "gb300 nvl72",
    "up to 142 kw",
    "product-specific",
    "hybrid cooling",
    "residual heat",
    "coolant distribution unit",
    "water chemistry",
    "leak detection",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("air, the default for the entire prior history of the data center, simply cannot");
  expect(flat).not.toContain("immersion, submerging the boards in dielectric fluid, is the next tier");
});

test("grid integration has a testable operating contract", () => {
  for (const phrase of [
    "may 4, 2026",
    "level 3 essential action alert",
    "customer-initiated large load reductions",
    "significant oscillations",
    "telemetry",
    "fault ride-through",
    "ramp rate",
    "rebound",
    "operating envelope",
    "firm contract demand",
    "non-firm contract demand",
  ]) expect(flat).toContain(phrase);
});

test("energy per result declares its accounting boundary", () => {
  for (const marker of [
    "e_{\\mathrm{result}}",
    "\\int_{t_0}^{t_1}",
    "P_{\\mathrm{fac}}(t)",
    "N_{\\mathrm{accept}}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "accepted result",
    "idle capacity",
    "training amortization",
    "embodied energy",
    "request mix",
    "quality threshold",
    "service-level objective",
  ]) expect(flat).toContain(phrase);
});

test("the time-to-power evidence contract is reproducible", () => {
  for (const phrase of [
    "electrical one-line",
    "bill of materials",
    "point of interconnection",
    "facility mw",
    "it mw",
    "firm and conditional",
    "evidence owner",
    "acceptance criterion",
    "recovery scenario",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-accelerators-networking",
    "@sec-economics",
    "@sec-serving-stack",
    "@sec-machine-breaks",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-powering-critical-path",
    "fig-powering-ledger",
    "fig-powering-control",
    "fig-powering-evidence",
  ]) expect(chapter).toContain(figure);
  expect(chapter).not.toContain("/figures/powering-it-1.svg");
});

test("the bibliography favors primary operators, regulators, and vendors", () => {
  for (const marker of [
    "prod.nerc.com/initiatives/large-loads-action-plan",
    "ferc.gov/news-events/news/ferc-launches-aggressive-targeted-action",
    "energy.gov/sites/default/files/2024-10/exec-2022-001242",
    "eta.lbl.gov/publications/doe-data-center-load-flexibility",
    "docs.nvidia.com/enterprise-reference-architectures/nvl72-ai-factory",
    "ashrae.org/technical-resources/ai-data-center-framework",
    "uptimeinstitute.com/resource/uptime-institute-global-data-center-survey-2025",
    "nrc.gov/info-finder/reactors/ccec",
  ]) expect(bibliography.toLowerCase()).toContain(marker);

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(10);
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
    currentHref: "infrastructure/powering-it.html",
    chapterTitle: "Powering It: Time-to-Power as the Binding Constraint",
    chapterNum: "68",
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
  expect(html).toContain("The durable skill is to turn a power claim into a dated evidence chain");
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
