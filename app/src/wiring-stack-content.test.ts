import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/08-wiring-a-2026-stack.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/wiring-a-2026-stack.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter begins with an integration release contract", () => {
  expect(chapter).toMatch(/^# Wiring the Stack \{#sec-wiring-stack\}/);
  for (const phrase of [
    "integration release",
    "system fingerprint",
    "boundary contract",
    "owner",
    "acceptance evidence",
    "rollback",
  ]) expect(flat).toContain(phrase);
});

test("the system fingerprint versions every behavior-bearing component", () => {
  for (const phrase of [
    "model revision",
    "prompt revision",
    "retrieval snapshot",
    "tool schema",
    "policy revision",
    "router configuration",
    "telemetry schema",
  ]) expect(flat).toContain(phrase);
});

test("each boundary has an operationally complete contract", () => {
  for (const phrase of [
    "producer",
    "consumer",
    "protocol version",
    "data class",
    "authority",
    "deadline",
    "retry owner",
    "idempotency",
    "error mapping",
    "telemetry",
    "migration",
  ]) expect(flat).toContain(phrase);
});

test("data, control, and management planes stay distinct", () => {
  for (const phrase of ["data plane", "control plane", "management plane"])
    expect(flat).toContain(phrase);
  expect(flat).toContain("not a universal hub");
});

test("capability negotiation makes translation loss visible", () => {
  for (const phrase of [
    "capability profile",
    "native",
    "adapter-emulated",
    "lossy",
    "unsupported",
    "explicitly accepted",
    "reject",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("lowest common denominator");
});

test("routing resolves immutable identity after hard constraints", () => {
  for (const phrase of [
    "hard constraint",
    "data residency",
    "immutable",
    "model revision",
    "adapter revision",
    "sticky",
  ]) expect(flat).toContain(phrase);
});

test("streaming tool calls follow an explicit state machine", () => {
  for (const phrase of [
    "typed event stream",
    "accumulate",
    "complete arguments",
    "validate",
    "authorize",
    "execute once",
    "partial tool arguments",
  ]) expect(flat).toContain(phrase);
});

test("structured output is validated only when complete", () => {
  for (const phrase of [
    "complete document",
    "json schema",
    "final validation",
    "invalid outcome",
  ]) expect(flat).toContain(phrase);
});

test("errors have stable machine semantics", () => {
  for (const phrase of [
    "rfc 9457",
    "application/problem+json",
    "problem type",
    "retryable",
    "upstream request id",
    "attempt number",
    "human-readable detail",
  ]) expect(flat).toContain(phrase);
});

test("deadlines, cancellation, and backpressure are end to end", () => {
  for (const phrase of [
    "remaining deadline",
    "cancellation",
    "bounded queue",
    "backpressure",
    "terminal state",
  ]) expect(flat).toContain(phrase);
});

test("retry amplification is self-contained and has one owner", () => {
  for (const marker of ["A_{\\max}", "\\prod_{\\ell=1}^{L}", "r_\\ell"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "physical attempt",
    "logical operation",
    "one retry owner",
    "retry amplification",
  ]) expect(flat).toContain(phrase);
});

test("fallback is a qualified system-identity change", () => {
  for (const phrase of [
    "fallback changes the system identity",
    "prequalified",
    "compatibility class",
    "visible output",
    "side effect",
  ]) expect(flat).toContain(phrase);
});

test("credentials are short-lived and audience-bound", () => {
  for (const phrase of [
    "workload identity",
    "token exchange",
    "audience",
    "scope",
    "tenant",
    "time to live",
    "static secret",
    "virtual key",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("one implementation");
});

test("MCP discovery is not authorization", () => {
  for (const phrase of [
    "capability negotiation",
    "does not grant authority",
    "tool annotation",
    "untrusted",
    "per invocation",
    "consent",
  ]) expect(flat).toContain(phrase);
});

test("sandboxing contains effects but does not authorize them", () => {
  for (const phrase of [
    "sandbox is not authorization",
    "blast radius",
    "egress allowlist",
    "resource allowlist",
    "effect class",
  ]) expect(flat).toContain(phrase);
});

test("retrieval evidence preserves authorization and revision identity", () => {
  for (const phrase of [
    "authorize before retrieval",
    "evidence id",
    "corpus revision",
    "index revision",
    "tenant boundary",
  ]) expect(flat).toContain(phrase);
});

test("trace context correlates but never authorizes", () => {
  for (const phrase of [
    "w3c trace context",
    "correlation",
    "not authority",
    "baggage",
    "missing telemetry",
  ]) expect(flat).toContain(phrase);
});

test("cost and latency account for the accepted task", () => {
  for (const phrase of [
    "accepted task",
    "physical attempt",
    "retrieval",
    "tool",
    "judge",
    "human review",
    "parallel child",
  ]) expect(flat).toContain(phrase);
});

test("the crossover example is preserved and dependency free", () => {
  expect(chapter).toContain('<div class="viz" data-viz="cost-crossover"');
  expect(chapter).toContain('<figure id="fig-wiring-a-2026-stack-cost-crossover">');
  const code = [...chapter.matchAll(/```python\n([\s\S]*?)\n```/g)]
    .map((match) => match[1])
    .find((body) => body.includes("crossover_utilization"));
  expect(code).toBeDefined();
  expect(code).not.toMatch(/numpy|pandas|matplotlib/i);
  expect(code).toContain("assert");
  const run = Bun.spawnSync(["python3", "-c", code!], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(new TextDecoder().decode(run.stderr)).toBe("");
  expect(run.exitCode).toBe(0);
});

test("conformance tests cover protocol and policy behavior", () => {
  for (const phrase of [
    "unary request",
    "stream interruption",
    "tool arguments",
    "structured output",
    "retry-after",
    "cancellation",
    "overload",
    "fallback",
    "tenant isolation",
    "telemetry",
  ]) expect(flat).toContain(phrase);
});

test("the release is pinned through the software supply chain", () => {
  for (const phrase of [
    "signed manifest",
    "provenance",
    "software bill of materials",
    "digest",
    "route table",
  ]) expect(flat).toContain(phrase);
});

test("cutover is staged, sticky, atomic, and reversible", () => {
  for (const phrase of [
    "contract test",
    "shadow",
    "no side effects",
    "sticky canary",
    "atomic",
    "last-known-good",
    "rollback",
  ]) expect(flat).toContain(phrase);
});

test("the failure matrix and lifecycle produce a release record", () => {
  for (const phrase of [
    "silent capability loss",
    "retry storm",
    "credential leak",
    "cross-tenant",
    "partial tool",
    "configuration drift",
    "integration release record",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes dated catalogs and universal defaults", () => {
  for (const phrase of [
    "as of mid-2026",
    "the 2026 shakeout",
    "best for",
    "a sensible default",
    "reported acquisition",
    "tokens/second",
    "virtual-key custody",
  ]) expect(flat).not.toContain(phrase);
  for (const marker of [
    "fig-integration-contract",
    "fig-reference-arch",
    "fig-cutover-path",
    "@sec-whole-stack",
    "@sec-serving-stack",
    "@sec-agents-practice",
    "@sec-retrieval-practice",
    "@sec-eval-practice",
    "@sec-security-authorization",
    "@sec-economics",
    "@gls-gateway",
    "@gls-mcp",
    "@gls-sandbox",
    "::: {#further-reading}",
  ]) expect(chapter).toContain(marker);
});

test("the bibliography uses primary research and official standards", () => {
  for (const title of [
    "Architectural Styles and the Design of Network-based Software Architectures",
    "Hidden Technical Debt in Machine Learning Systems",
    "The ML Test Score",
    "HTTP Semantics",
    "Problem Details for HTTP APIs",
    "OAuth 2.0 Token Exchange",
    "Model Context Protocol Specification",
    "Trace Context",
    "The Tail at Scale",
    "in-toto: Providing farm-to-table guarantees for bits and bytes",
    "SLSA Specification",
    "Zero Trust Architecture",
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
    currentHref: "practice/wiring-a-2026-stack.html",
    chapterTitle: "Wiring the Stack",
    chapterNum: "88",
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
  expect(html).toContain("The output is an integration release record");
  expect(headings.some(({ text }) => text.includes("A_{"))).toBeFalse();
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
      "practice/wiring-a-2026-stack.html",
      "",
    );
    svgs.push(svg);
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
  for (const label of ["Caller", "Policy", "Adapter", "Provider"])
    expect(svgs[1], `reference architecture should show ${label}`).toContain(`>${label}<`);
});
