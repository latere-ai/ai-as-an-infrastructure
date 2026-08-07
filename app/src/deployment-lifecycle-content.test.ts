import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/09-deployment-lifecycle.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/deployment-lifecycle.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter begins with a deployment release contract", () => {
  expect(chapter).toMatch(/^# The Deployment Lifecycle \{#sec-deployment-lifecycle\}/);
  for (const phrase of [
    "controlled state transition",
    "deployment release contract",
    "known baseline",
    "candidate",
    "compatibility",
    "evidence",
    "exposure",
    "recovery",
  ]) expect(flat).toContain(phrase);
});

test("the release manifest fingerprints every behavior-bearing component", () => {
  for (const phrase of [
    "model revision",
    "serving runtime",
    "prompt revision",
    "retrieval snapshot",
    "tool schema",
    "policy revision",
    "router configuration",
    "data schema",
    "telemetry schema",
    "assignment policy",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("separately deployed");
  expect(flat).toContain("release manifest");
});

test("release vocabulary separates availability, exposure, and recovery", () => {
  for (const term of [
    "deploy",
    "release",
    "promote",
    "abort",
    "rollback",
    "roll forward",
  ]) expect(flat).toContain(term);
  expect(flat).toContain("not synonyms");
});

test("the compatibility envelope covers mixed-version state", () => {
  for (const phrase of [
    "compatibility envelope",
    "old reader",
    "new reader",
    "old writer",
    "new writer",
    "request and response",
    "event schema",
    "retrieval index",
    "cache",
    "session state",
    "checkpoint state",
  ]) expect(flat).toContain(phrase);
});

test("state migration preserves a bounded recovery window", () => {
  for (const phrase of [
    "expand",
    "dual-read",
    "dual-write",
    "backfill",
    "verify",
    "contract",
    "rollback window",
  ]) expect(flat).toContain(phrase);
});

test("artifact identity is authenticated and resistant to stale combinations", () => {
  for (const phrase of [
    "signed manifest",
    "provenance",
    "software bill of materials",
    "digest",
    "rollback attack",
    "freeze attack",
    "mix-and-match",
  ]) expect(flat).toContain(phrase);
});

test("shadow execution is isolated and side-effect free", () => {
  for (const phrase of [
    "shadow",
    "current authorization",
    "suppress side effects",
    "isolated cache",
    "isolated state",
    "discard",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("zero user risk");
});

test("canary assignment is sticky, observable, and keeps a control", () => {
  for (const phrase of [
    "assignment unit",
    "tenant",
    "user",
    "session",
    "sticky",
    "concurrent control",
    "assignment record",
    "actual exposure",
    "sample ratio mismatch",
  ]) expect(flat).toContain(phrase);
});

test("online evidence accounts for interference and delayed outcomes", () => {
  for (const phrase of [
    "interference",
    "shared failure",
    "carryover",
    "novelty",
    "delayed outcome",
  ]) expect(flat).toContain(phrase);
});

test("promotion uses explicit non-inferiority bounds and guardrails", () => {
  for (const marker of ["\\Delta_j", "L_j", "-\\delta_j"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "non-inferiority margin",
    "primary metric",
    "absolute slo",
    "harm boundary",
    "evidence completeness",
    "fail closed",
  ]) expect(flat).toContain(phrase);
});

test("sequential monitoring does not reuse fixed-horizon significance", () => {
  for (const phrase of [
    "fixed horizon",
    "always-valid",
    "continuous monitoring",
    "optional stopping",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("worse_with_significance");
});

test("deterministic contracts remain beside statistical evaluation", () => {
  for (const phrase of [
    "deterministic invariant",
    "schema validation",
    "authorization",
    "idempotency",
    "statistical comparison does not replace",
  ]) expect(flat).toContain(phrase);
});

test("rollout widens by cells or regions with bounded concurrency", () => {
  for (const phrase of [
    "cell",
    "region",
    "blast radius",
    "one active change",
    "atomic",
    "last-known-good",
  ]) expect(flat).toContain(phrase);
});

test("mutable dependencies trigger detection and requalification", () => {
  for (const phrase of [
    "provider revision",
    "immutable revision",
    "change-detection probe",
    "requalification",
    "deprecation",
    "configuration drift",
  ]) expect(flat).toContain(phrase);
});

test("recovery distinguishes reversible and irreversible changes", () => {
  for (const phrase of [
    "traffic rollback",
    "state restore",
    "feature disable",
    "credential revoke",
    "compensate",
    "roll forward",
    "irreversible effect",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("rollback is a routing change, not a rebuild");
});

test("rollback is conditional on explicit prerequisites", () => {
  for (const phrase of [
    "previous artifact",
    "backward-compatible",
    "capacity headroom",
    "credential",
    "recovery window",
    "rto",
    "rpo",
  ]) expect(flat).toContain(phrase);
});

test("recovery handles in-flight work and verifies the restored service", () => {
  for (const phrase of [
    "drain",
    "cancel",
    "in-flight",
    "queue",
    "backlog",
    "mixed-version",
    "recovery verification",
  ]) expect(flat).toContain(phrase);
});

test("incident operation has ownership and emergency controls", () => {
  for (const phrase of [
    "incident commander",
    "release owner",
    "kill switch",
    "timeline",
    "conformance test",
    "failure matrix",
  ]) expect(flat).toContain(phrase);
});

test("the lifecycle produces a deployment release record", () => {
  for (const phrase of [
    "build and verify",
    "offline gate",
    "dark launch",
    "canary",
    "full release",
    "deployment release record",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("The output is a deployment release record");
});

test("the rewrite preserves stable interfaces and removes unsafe shortcuts", () => {
  for (const marker of [
    "fig-deploy-bundle",
    "fig-deploy-pipeline",
    "fig-recovery-path",
    "@sec-serving-problem",
    "@sec-wiring-stack",
    "@sec-eval-practice",
    "@sec-security-authorization",
    "::: {#further-reading}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "one immutable bundle",
    "only cost is the compute",
    "previous good bundle is always one routing change away",
    "for pct in (0, 1, 5, 25, 100)",
  ]) expect(flat).not.toContain(phrase);
});

test("the bibliography uses primary research and official standards", () => {
  for (const title of [
    "Hidden Technical Debt in Machine Learning Systems",
    "The ML Test Score",
    "Canarying Releases",
    "Controlled Experiments on the Web",
    "Diagnosing Sample Ratio Mismatch",
    "Always Valid Inference",
    "The Update Framework Specification",
    "SLSA Specification",
    "Contingency Planning Guide for Federal Information Systems",
  ]) expect(bibliography).toContain(title);
});

test("hard wraps and citations remain mechanically sound", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
  for (const delimiter of ["\\(", "\\)", "\\[", "\\]"])
    expect(chapter).not.toContain(delimiter);
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

test("the complete chapter renders through its release handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/deployment-lifecycle.html",
    chapterTitle: "The Deployment Lifecycle",
    chapterNum: "89",
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
  expect(html).toContain("The output is a deployment release record");
  expect(headings.some(({ text }) => text.includes("\\Delta"))).toBeFalse();
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses through the production path and fits mobile", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  const svgs: string[] = [];
  for (const block of blocks) {
    const svg = renderDot(
      graphviz,
      block[1],
      new Map(),
      "practice/deployment-lifecycle.html",
      "",
    );
    svgs.push(svg);
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
  for (const label of ["Abort", "Restore", "Roll forward"])
    expect(svgs[2], `recovery path should show ${label}`).toContain(`>${label}<`);
});
