import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/13-operating-contracts.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/operating-contracts.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter defines a versioned operating contract that changes decisions", () => {
  expect(chapter).toMatch(
    /^# Operating Contracts: SLOs, Cost, Incidents, and Tenancy \{#sec-operating-contracts\}/,
  );
  for (const phrase of [
    "versioned operating contract",
    "user promise",
    "enforcement",
    "decision rights",
    "evidence",
    "operating contract release record",
  ]) expect(flat).toContain(phrase);
});

test("the contract schema defines scope, ownership, measurement, and lifecycle", () => {
  for (const phrase of [
    "contract identity",
    "effective time",
    "expiry",
    "task class",
    "eligible traffic",
    "owner",
    "approver",
    "dependency",
    "measurement source",
    "missing data",
    "exception",
    "rollback",
  ]) expect(flat).toContain(phrase);
});

test("SLIs, SLOs, and SLAs remain distinct", () => {
  for (const phrase of [
    "service level indicator",
    "service level objective",
    "service level agreement",
    "external commitment",
    "remedy",
    "not interchangeable",
  ]) expect(flat).toContain(phrase);
});

test("event-based SLIs define population, predicate, and unknown outcomes", () => {
  for (const marker of [
    "\\operatorname{SLI}_W",
    "e \\in E_W",
    "\\mathbf{1}",
    "G(e)",
    "|E_W|",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "eligible event",
    "good-event predicate",
    "measurement window",
    "unknown",
    "cancelled",
    "timed out",
  ]) expect(flat).toContain(phrase);
});

test("semantic quality uses a separate sampled measurement contract", () => {
  for (const phrase of [
    "probability sample",
    "inclusion probability",
    "judge version",
    "human calibration",
    "label delay",
    "confidence interval",
    "measurement coverage",
    "cannot provide an immediate page",
  ]) expect(flat).toContain(phrase);
});

test("error budgets drive burn-rate policy rather than a Wilson pager", () => {
  for (const marker of ["b = 1 - S^*", "\\beta_W", "q_W"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "error budget",
    "burn rate",
    "multiwindow",
    "low-traffic",
    "page",
    "ticket",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("wilson lower");
});

test("cost is accounted per accepted task across every attempt", () => {
  for (const marker of ["C_t", "A_t", "\\mathbf{1}[\\operatorname{accepted}(t)]"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "retry",
    "fallback",
    "retrieval",
    "tool",
    "judge",
    "human review",
    "storage",
    "cost per accepted task",
  ]) expect(flat).toContain(phrase);
});

test("the total-cost equation is split into mobile-safe rows", () => {
  expect(chapter).toContain("\\begin{aligned}\nC_t");
  expect(chapter).toContain("C^{\\mathrm{retrieval}}_a \\\\");
  expect(chapter).toContain("C^{\\mathrm{judge}}_a\n  \\bigr) \\\\");
});

test("runtime budgets estimate, reserve, admit, meter, and reconcile", () => {
  for (const phrase of [
    "estimate",
    "reserve",
    "admit",
    "meter",
    "reconcile",
    "budget hierarchy",
    "price version",
    "late charge",
    "unknown usage",
    "qualified fallback",
  ]) expect(flat).toContain(phrase);
});

test("the reservation ledger is dependency-free, idempotent, and executable", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  for (const phrase of [
    "class BudgetLedger",
    "contract_version",
    "tenant_id",
    "reservation_id",
    "reserve",
    "reconcile",
    "assert",
  ]) expect(cell![1]).toContain(phrase);
  expect(cell![1]).not.toMatch(/numpy|pandas|requests/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain("spent=25 available=75");
});

test("billing normalization is not confused with runtime enforcement", () => {
  for (const phrase of [
    "focus 1.4",
    "4 june 2026",
    "billing data",
    "not a live admission controller",
    "provider adoption",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("per-model token consumption for the release after it");
});

test("request context is minimized and cannot authorize by correlation", () => {
  for (const phrase of [
    "opaque tenant identifier",
    "contract version",
    "task class",
    "reservation identifier",
    "trace identifier",
    "minimum claims",
    "re-authorize",
    "trace context does not authorize",
  ]) expect(flat).toContain(phrase);
});

test("contract changes use a controlled release lifecycle", () => {
  for (const phrase of [
    "draft",
    "validate",
    "shadow",
    "canary",
    "activate",
    "monitor",
    "rollback",
    "deprecate",
    "emergency exception",
    "expires automatically",
  ]) expect(flat).toContain(phrase);
});

test("incident response defines state, roles, clocks, and evidence", () => {
  for (const phrase of [
    "incident commander",
    "operations lead",
    "communications lead",
    "evidence owner",
    "detection time",
    "acknowledgement time",
    "containment time",
    "restoration time",
    "unknown commit",
    "immutable evidence snapshot",
  ]) expect(flat).toContain(phrase);
});

test("incident learning can change controls or record a justified no-change decision", () => {
  for (const phrase of [
    "root cause",
    "contributing conditions",
    "corrective action",
    "accepted risk",
    "no-change decision",
    "owner",
    "deadline",
    "verification",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("is only prose");
});

test("tenant isolation is defined across independently enforced boundaries", () => {
  for (const phrase of [
    "control plane",
    "data plane",
    "admission",
    "scheduler",
    "kv cache",
    "retrieval namespace",
    "encryption key",
    "tool credential",
    "egress",
    "review queue",
    "billing",
    "namespace alone",
  ]) expect(flat).toContain(phrase);
});

test("fairness and noisy-neighbor behavior are tested under contention", () => {
  for (const phrase of [
    "quota",
    "reservation",
    "concurrency",
    "priority",
    "queue discipline",
    "backpressure",
    "load shedding",
    "noisy-neighbor test",
    "tenant a",
    "tenant b",
  ]) expect(flat).toContain(phrase);
});

test("governance sources are scoped rather than presented as certification", () => {
  for (const phrase of [
    "voluntary",
    "not a certification",
    "vendor-specific",
    "does not replace",
    "legal",
    "security",
    "privacy",
  ]) expect(flat).toContain(phrase);
});

test("scenario tests and the release record cover negative paths", () => {
  for (const phrase of [
    "missing tenant claim",
    "unknown contract version",
    "metric pipeline outage",
    "delayed label",
    "duplicate reservation",
    "retry bypass",
    "late cost",
    "qualified fallback unavailable",
    "cross-tenant cache",
    "cross-tenant retrieval",
    "evidence-store failure",
    "operating contract release record",
  ]) expect(flat).toContain(phrase);
});

test("stable interfaces remain while unsupported curves and absolutes disappear", () => {
  for (const marker of [
    "#sec-operating-contracts",
    "fig-operating-contracts-control-plane",
    "fig-operating-incident-loop",
    "@sec-wiring-stack",
    "@sec-reliability",
    "@sec-human-interface-oversight",
    "@sec-data-engine",
    "## Constraint Arrow",
    "::: {#further-reading}",
  ]) expect(chapter).toContain(marker);
  for (const marker of [
    "fig-operating-contracts-1",
    "fig-operating-contracts-risk",
    'data-family="exp-decay"',
  ]) expect(chapter).not.toContain(marker);
  for (const phrase of [
    "the shape is not",
    "the difficult part is political rather than mathematical",
    "is only prose",
    "the hardest question",
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
  expect(bibliography).toMatch(
    /@techreport\{nist2023airmf,[\s\S]*?author\s*=\s*\{Tabassi, Elham\}/,
  );
});

test("the complete chapter renders through its release record", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/operating-contracts.html",
    chapterTitle: "Operating Contracts: SLOs, Cost, Incidents, and Tenancy",
    chapterNum: "93",
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
  expect(html).toContain("operating contract release record");
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("both Graphviz figures parse and fit a mobile column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)]
    .filter((match) => /fig-operating-(?:contracts-control-plane|incident-loop)/.test(match[1]));
  expect(blocks).toHaveLength(2);
  const graphviz = await loadGraphviz();
  for (const [, block] of blocks) {
    expect(block).toContain("rankdir=TB");
    const svg = renderDot(
      graphviz,
      block,
      new Map(),
      "practice/operating-contracts.html",
      "",
    );
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
