import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/ecosystem/03-tooling-ecosystem.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/ecosystem/03-tooling-ecosystem.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/tooling-ecosystem.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter treats a toolchain as versioned contracts rather than a catalog", () => {
  expect(chapter).toMatch(/^# The Tooling Ecosystem \{#sec-tooling-ecosystem\}/);
  for (const phrase of [
    "a tooling stack is a set of versioned contracts",
    "not a framework list",
    "verified model bundle",
    "replaceability",
    "failure containment",
    "observed evidence",
  ]) expect(flat).toContain(phrase);
});

test("execution control and evidence remain separate planes", () => {
  for (const phrase of [
    "execution plane",
    "control plane",
    "evidence plane",
    "executes the call",
    "decides whether",
    "records what happened",
  ]) expect(flat).toContain(phrase);
});

test("component and edge contracts make compatibility explicit", () => {
  for (const marker of ["C_i", "V_i", "I_i", "O_i", "A_i", "S_i", "F_i", "E_i", "T", "w"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "component contract",
    "supported version",
    "accepted inputs",
    "produced outputs",
    "authority requirements",
    "state semantics",
    "failure semantics",
    "emitted evidence",
    "edge compatibility",
    "workload",
  ]) expect(flat).toContain(phrase);
});

test("training and serving tools are selected by their boundary contracts", () => {
  for (const phrase of [
    "checkpoint",
    "reshard",
    "backward compatibility",
    "model format",
    "serving runtime",
    "pagedattention",
    "workload-specific",
    "latency",
    "throughput",
    "failure injection",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("which removed the fragmentation that capped throughput");
});

test("an agent host a tool server and a peer agent keep different roles", () => {
  for (const phrase of [
    "agent host",
    "tool server",
    "peer agent",
    "bounded operation",
    "independent task state",
    "mcp",
    "a2a",
  ]) expect(flat).toContain(phrase);
});

test("MCP is described at its current pinned protocol and security boundary", () => {
  for (const phrase of [
    "2026-07-28",
    "host-client-server",
    "json-rpc",
    "stateless",
    "per-request capability negotiation",
    "tools, resources, and prompts",
    "json schema 2020-12",
    "explicit consent",
    "does not grant permission",
    "tool descriptions",
    "untrusted",
  ]) expect(flat).toContain(phrase);
});

test("A2A v1.0 is an asynchronous task protocol rather than a trust layer", () => {
  for (const phrase of [
    "a2a v1.0",
    "agent card",
    "message",
    "task",
    "artifact",
    "a2a-version",
    "terminal state",
    "does not prove",
    "correct",
  ]) expect(flat).toContain(phrase);
});

test("security properties are enforced at every protocol hop", () => {
  for (const phrase of [
    "discovery is not authorization",
    "least privilege",
    "token passthrough",
    "audience",
    "sandbox",
    "allowlist",
    "human approval",
    "secret",
    "redact",
  ]) expect(flat).toContain(phrase);
});

test("the evidence plane records replayable cross-layer facts", () => {
  for (const phrase of [
    "trace id",
    "resolved model",
    "protocol version",
    "schema digest",
    "authorization decision",
    "retry",
    "cancellation",
    "budget",
    "sensitive content",
  ]) expect(flat).toContain(phrase);
});

test("portability is tested at wire and semantic levels", () => {
  for (const phrase of [
    "wire compatibility",
    "semantic compatibility",
    "conformance test",
    "contract test",
    "exit test",
    "silent fallback",
    "switching cost",
  ]) expect(flat).toContain(phrase);
});

test("the adoption procedure fails closed before promotion", () => {
  for (const phrase of [
    "inventory",
    "pin",
    "compatibility matrix",
    "threat model",
    "negative authorization",
    "idempotency",
    "cancel",
    "rollback",
    "promote",
  ]) expect(flat).toContain(phrase);
});

test("the runnable rejects version drift and a missing lifecycle guarantee", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toMatch(/numpy|torch|requests|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toBe(
    "candidate-a: compatible (6 contracts)\n" +
      "candidate-schema-drift: rejected (tool.schema: expected calendar.v3, got calendar.v4)\n" +
      "candidate-no-cancel: rejected (task.cancel: expected required, got missing)\n",
  );
});

test("the rewrite removes the product pitch and categorical legacy framing", () => {
  for (const phrase of [
    "the caller that broke the tooling",
    "the one move",
    "latere lux",
    "latere cella",
    "latere topos",
    "latere wallfacer",
    "80% improving",
    "the synthesis most of the field has reached",
  ]) expect(flat).not.toContain(phrase);
});

test("stable interfaces and cross-layer handoffs remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  for (const ref of [
    "@sec-model-artifacts",
    "@sec-training-at-scale",
    "@sec-serving-problem",
    "@sec-the-harness",
    "@sec-multi-agent-systems",
    "@sec-security-authorization",
    "@sec-eval-practice",
    "@sec-economics",
  ]) expect(chapter).toContain(ref);
  for (const figure of [
    "fig-tooling-planes",
    "fig-tooling-protocols",
    "fig-tooling-adoption",
  ]) expect(chapter).toContain(figure);
});

test("hard wraps do not split hyphenated compounds in rendered prose", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("the bibliography favors official specifications and archival research", () => {
  for (const marker of [
    "docs.pytorch.org/docs/stable/distributed.checkpoint.html",
    "10.1145/3600006.3613165",
    "modelcontextprotocol.io/specification/2026-07-28",
    "modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices",
    "a2a-protocol.org/latest/specification",
    "openreview.net/forum?id=we_vluyul-x",
    "w3.org/tr/trace-context",
    "arxiv.org/abs/2508.14925",
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

test("the complete chapter renders without swallowing figures or late prose", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/tooling-ecosystem.html",
    chapterTitle: "The Tooling Ecosystem",
    chapterNum: "75",
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
  expect(html).toContain("A protocol makes an edge legible; only tests and policy make the composed system acceptable");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(3);
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
