import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/11-human-interface-oversight.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/human-interface-oversight.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter starts with an enforceable oversight boundary", () => {
  expect(chapter).toMatch(
    /^# Human Interfaces and Oversight Loops \{#sec-human-interface-oversight\}/,
  );
  for (const phrase of [
    "enforceable decision boundary",
    "change what the system may do",
    "presentation",
    "decision",
    "enforcement",
    "effect",
    "trace",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("surface is not just user experience");
});

test("the oversight contract names the fields needed to govern an effect", () => {
  for (const phrase of [
    "proposal identity",
    "subject",
    "scope",
    "payload",
    "resource version",
    "expiry",
    "reviewer eligibility",
    "timeout",
    "recovery",
    "outcome",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toContain("fig-human-interface-control-plane");
});

test("human-in-the-loop is defined by timing, authority, and failure behavior", () => {
  expect(flat).toContain(
    "@gls-human-in-the-loop means that a named person or role can inspect relevant evidence and change execution",
  );
  for (const phrase of [
    "before commit",
    "during execution",
    "after the outcome",
    "time budget",
    "timeout default",
    "takeover",
    "practice",
  ]) expect(flat).toContain(phrase);
});

test("the stepper preserves its interface while distinguishing proposal from outcome", () => {
  for (const marker of [
    'id="fig-human-interface-oversight-stepper"',
    'data-viz="stepper"',
    'data-chip="APPROVE"',
    "PROPOSE",
    "INSPECT",
    "COMMIT",
    "VERIFY",
  ]) expect(chapter).toContain(marker);
  expect(flat).not.toContain("idempotent rollback path");
});

test("calibrated reliance evaluates joint decisions rather than acceptance", () => {
  expect(flat).toContain(
    "@gls-calibrated-reliance means accepting correct help and checking, changing, or rejecting incorrect help",
  );
  expect(flat).toContain(
    "@gls-automation-bias is the tendency to over-accept automated advice",
  );
  for (const phrase of [
    "ai correct",
    "ai incorrect",
    "human accepts",
    "human overrides",
    "joint outcome",
    "acceptance rate alone",
  ]) expect(flat).toContain(phrase);
});

test("review information privileges evidence over persuasive explanation", () => {
  for (const phrase of [
    "exact action diff",
    "provenance",
    "counterevidence",
    "missing inputs",
    "out of distribution",
    "calibrated for the task",
    "cannot grant authority",
  ]) expect(flat).toContain(phrase);
});

test("approval is bound to the exact authorized action and rechecked at commit", () => {
  for (const phrase of [
    "approval record",
    "action hash",
    "resource version",
    "precondition",
    "expires",
    "revalidate",
    "time-of-check",
    "time-of-use",
    "does not transfer accountability",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("where accountability changes hands");
});

test("the runnable gate is policy-driven, dependency-free, and self-checking", () => {
  for (const phrase of [
    "def authorize",
    "policy",
    "action_hash",
    "resource_version",
    "assert",
  ]) expect(chapter).toContain(phrase);
  expect(chapter).not.toContain("import numpy");
  expect(chapter).not.toMatch(/risk\s*>=\s*0\.[0-9]/);
  expect(chapter).not.toMatch(/confidence\s*<\s*0\.[0-9]/);
});

test("cancellation, unknown commit, compensation, and containment are distinct", () => {
  for (const phrase of [
    "cancellation request",
    "execution acknowledgement",
    "unknown commit",
    "reconciliation",
    "compensation",
    "containment",
    "rollback is impossible",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("a stop button that actually cancels tool execution");
});

test("separation of duties defines reviewer independence and quorum", () => {
  for (const phrase of [
    "separation of duties",
    "independence",
    "quorum",
    "conflict of interest",
    "shared failure",
  ]) expect(flat).toContain(phrase);
});

test("review capacity is treated as an operated queue", () => {
  for (const marker of ["\\lambda", "\\mu", "c", "\\rho"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "arrival rate",
    "service rate",
    "utilization",
    "backlog",
    "priority",
    "overload mode",
    "reviewer fatigue",
  ]) expect(flat).toContain(phrase);
});

test("handoff has ownership, acknowledgement, deadline, and bounded escalation", () => {
  for (const phrase of [
    "handoff owner",
    "acknowledgement",
    "deadline",
    "context bundle",
    "escalation reason",
    "infinite bounce",
  ]) expect(flat).toContain(phrase);
});

test("feedback events retain provenance without pretending to be labels", () => {
  for (const phrase of [
    "feedback event is not a ground-truth label",
    "before artifact",
    "after artifact",
    "reason code",
    "task version",
    "release version",
    "reviewer",
    "later outcome",
    "inclusion probability",
    "selection bias",
    "representative audit sample",
  ]) expect(flat).toContain(phrase);
});

test("metrics cover joint quality, observability, and queue health", () => {
  for (const phrase of [
    "false accept",
    "false reject",
    "adjudication",
    "measurement coverage",
    "review latency",
    "queue age",
    "abandonment",
    "slice",
    "not causal",
  ]) expect(flat).toContain(phrase);
});

test("the legal note is scoped and uses the current enacted timeline", () => {
  for (const phrase of [
    "article 14",
    "high-risk ai systems",
    "2 december 2027",
    "2 august 2028",
    "27 july 2026",
    "not a universal product rule",
    "voluntary",
  ]) expect(flat).toContain(phrase);
  expect(bibliography).toContain("Regulation ({EU}) 2026/1744");
  expect(bibliography).toContain("Digital Omnibus");
  expect(bibliography).toContain("https://eur-lex.europa.eu/eli/reg/2026/1744/oj");
});

test("scenario tests and an oversight release record close the loop", () => {
  for (const phrase of [
    "stale preview",
    "changed payload",
    "expired approval",
    "duplicate commit",
    "failed cancellation",
    "reviewer outage",
    "queue overload",
    "missing trace",
    "oversight release record",
  ]) expect(flat).toContain(phrase);
});

test("stable interfaces remain while machine-like absolutes disappear", () => {
  for (const marker of [
    "#sec-human-interface-oversight",
    "fig-human-interface-control-plane",
    "fig-human-interface-oversight-stepper",
    "@sec-the-harness",
    "@sec-data-engine",
    "## Constraint Arrow",
    "::: {#further-reading}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "the rule is simple",
    "thumbs-down, by contrast, means almost nothing",
    "it is only friction",
    "counts for nothing",
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
    currentHref: "practice/human-interface-oversight.html",
    chapterTitle: "Human Interfaces and Oversight Loops",
    chapterNum: "91",
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
  expect(html).toContain("oversight release record");
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("the control-plane Graphviz parses and fits a mobile column", async () => {
  const block = chapter.match(
    /```\{dot\}\n([\s\S]*?label: fig-human-interface-control-plane[\s\S]*?)\n```/,
  );
  expect(block).toBeDefined();
  expect(block![1]).toContain("rankdir=TB");
  const graphviz = await loadGraphviz();
  const svg = renderDot(
    graphviz,
    block![1],
    new Map(),
    "practice/human-interface-oversight.html",
    "",
  );
  expect(svg).not.toContain("graphviz error");
  const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
});
