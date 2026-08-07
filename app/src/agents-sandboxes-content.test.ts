import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/05-agents-and-sandboxes.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/agents-and-sandboxes.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter begins with an explicit agent execution contract", () => {
  expect(chapter).toMatch(/^# Agents, Frameworks, and Sandboxes \{#sec-agents-practice\}/);
  for (const phrase of [
    "agent execution contract",
    "task boundary",
    "success evidence",
    "permitted effects",
    "authority",
    "data boundary",
    "budget",
    "termination",
    "recovery",
    "rollback",
  ]) expect(flat).toContain(phrase);
});

test("the control loop separates model proposals from external effects", () => {
  for (const phrase of [
    "model proposal",
    "schema validation",
    "policy decision",
    "human approval",
    "tool execution",
    "observation",
    "checkpoint",
    "terminal state",
  ]) expect(flat).toContain(phrase);
  for (const marker of ["s_{t+1}", "\\pi_{\\theta}", "\\delta"])
    expect(chapter).toContain(marker);
});

test("the transition model defines every symbol and uses supported math delimiters", () => {
  for (const phrase of [
    "current durable run state",
    "context projection",
    "model distribution",
    "validated proposed action",
    "authorization decision",
    "tool observation",
    "deterministic transition function",
  ]) expect(flat).toContain(phrase);
  for (const delimiter of ["\\(", "\\)", "\\[", "\\]"])
    expect(chapter).not.toContain(delimiter);
  expect(chapter).not.toContain("\t");
});

test("every run is bounded by explicit stop conditions", () => {
  for (const phrase of [
    "step budget",
    "token budget",
    "wall-clock deadline",
    "cost budget",
    "consecutive failure",
    "no-progress",
    "cancelled",
    "timed out",
    "budget exhausted",
  ]) expect(flat).toContain(phrase);
});

test("framework selection follows control semantics rather than a leaderboard", () => {
  for (const phrase of [
    "capability matrix",
    "linear loop",
    "state graph",
    "durable workflow",
    "filesystem harness",
    "supervisor and worker",
    "cancellation",
    "concurrency",
    "checkpoint semantics",
    "provider portability",
  ]) expect(flat).toContain(phrase);
  for (const phrase of [
    "pick langgraph",
    "pick e2b",
    "sensible default",
    "best for",
    "production rankings",
    "github stars",
    "pricing model (2026)",
  ]) expect(flat).not.toContain(phrase);
});

test("durability includes effect receipts and idempotent recovery", () => {
  for (const phrase of [
    "event log",
    "effect receipt",
    "idempotency key",
    "at-least-once",
    "retry",
    "duplicate",
    "resume",
    "replay",
    "side effect",
  ]) expect(flat).toContain(phrase);
});

test("tool contracts specify behavior beyond input schemas", () => {
  for (const phrase of [
    "input schema",
    "output schema",
    "precondition",
    "postcondition",
    "side-effect class",
    "idempotency",
    "timeout",
    "error taxonomy",
    "data classification",
    "credential scope",
  ]) expect(flat).toContain(phrase);
});

test("MCP interoperability is not confused with trust or authorization", () => {
  for (const phrase of [
    "wire protocol",
    "version negotiation",
    "capability negotiation",
    "does not grant",
    "tool discovery",
    "authorization",
    "token audience",
    "token passthrough",
    "confused deputy",
  ]) expect(flat).toContain(phrase);
  for (const phrase of ["any mcp server", "became a non-question", "almost all frameworks"])
    expect(flat).not.toContain(phrase);
});

test("approval is bound to the exact effect and rechecked at execution", () => {
  for (const phrase of [
    "exact effect",
    "arguments",
    "resource",
    "principal",
    "policy version",
    "expires",
    "re-authorize",
    "execution boundary",
  ]) expect(flat).toContain(phrase);
});

test("sandbox choice begins from a declared threat model", () => {
  for (const phrase of [
    "threat model",
    "host escape",
    "cross-tenant",
    "data exfiltration",
    "denial of service",
    "supply chain",
    "persistence",
    "trusted operator",
  ]) expect(flat).toContain(phrase);
});

test("isolation mechanisms are compared without a universal winner", () => {
  for (const phrase of [
    "linux namespaces",
    "cgroups",
    "seccomp",
    "shared host kernel",
    "userspace kernel",
    "microvm",
    "guest kernel",
    "language isolate",
    "browser process",
    "defense in depth",
  ]) expect(flat).toContain(phrase);
  for (const phrase of ["only robust defense", "provable line", "strongest commonly-deployed"])
    expect(flat).not.toContain(phrase);
});

test("the sandbox envelope names every operational limit", () => {
  for (const phrase of [
    "filesystem",
    "read-only",
    "network egress",
    "cpu",
    "memory",
    "process count",
    "disk",
    "wall-clock",
    "workspace lifetime",
    "image digest",
  ]) expect(flat).toContain(phrase);
});

test("credentials remain outside the untrusted execution environment", () => {
  for (const phrase of [
    "@gls-virtual-key issued by a @gls-gateway for model access, a short-lived scoped substitute for a provider key",
    "no raw provider key",
    "egress substitution",
    "allowed destination",
    "short-lived token",
    "default-deny",
  ]) expect(flat).toContain(phrase);
});

test("workspace state and artifacts retain provenance", () => {
  for (const phrase of [
    "clean baseline",
    "workspace snapshot",
    "input digest",
    "output digest",
    "image digest",
    "reset",
    "quarantine",
    "malware",
    "artifact provenance",
  ]) expect(flat).toContain(phrase);
});

test("observability records decisions as well as model messages", () => {
  for (const phrase of [
    "run id",
    "trace id",
    "parent span",
    "model revision",
    "tool version",
    "policy decision",
    "approval",
    "resource usage",
    "terminal reason",
  ]) expect(flat).toContain(phrase);
});

test("verification covers recovery, containment, and hostile inputs", () => {
  for (const phrase of [
    "indirect prompt injection",
    "malicious tool output",
    "fork bomb",
    "filesystem escape",
    "egress attempt",
    "duplicate delivery",
    "worker crash",
    "stale approval",
    "canary",
  ]) expect(flat).toContain(phrase);
});

test("the operating lifecycle includes requalification triggers", () => {
  for (const phrase of [
    "freeze the contract",
    "failure injection",
    "shadow",
    "canary",
    "last-known-good",
    "requalification trigger",
    "model revision",
    "tool schema",
    "policy change",
    "sandbox image",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes volatile catalogs and keeps stable chapter interfaces", () => {
  for (const phrase of [
    "as of mid-2026",
    "june 2026",
    "sub-90ms",
    "under 200ms",
    "zero charge while idle",
    "default to e2b",
    "nothing else matches",
  ]) expect(flat).not.toContain(phrase);
  for (const marker of [
    "fig-agent-control-loop",
    "fig-agent-tool-boundary",
    "fig-agent-runtime",
    "@sec-agent-architectures",
    "@sec-the-harness",
    "@sec-security-authorization",
    "@sec-serving-stack",
    "@sec-wiring-stack",
    "@sec-eval-practice",
    "::: {#further-reading}",
  ]) expect(chapter).toContain(marker);
  expect(chapter).not.toContain('data-set="agent-frameworks"');
});

test("the bibliography favors primary research, standards, and official specifications", () => {
  for (const title of [
    "ReAct: Synergizing Reasoning and Acting in Language Models",
    "The Protection of Information in Computer Systems",
    "InjecAgent: Benchmarking Indirect Prompt Injections",
    "AgentDojo: A Dynamic Environment",
    "Firecracker: Lightweight Virtualization",
    "Application Container Security Guide",
    "Model Context Protocol 2026-07-28",
    "Security Best Practices",
    "Trace Context",
  ]) expect(bibliography).toContain(title);
});

test("hard wraps and citations remain mechanically sound", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
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

test("the complete chapter renders through its operating handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/agents-and-sandboxes.html",
    chapterTitle: "Agents, Frameworks, and Sandboxes",
    chapterNum: "85",
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
  expect(html).toContain("The output is an agent release record");
  expect(headings.some(({ text }) => text.includes("\\pi_"))).toBeFalse();
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = renderDot(graphviz, block[1], new Map(), "practice/agents-and-sandboxes.html", "");
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
