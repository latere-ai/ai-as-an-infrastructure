import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/orchestration/10-context-engineering.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/context-engineering.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("context is a bounded projection rather than the model's whole knowledge", () => {
  for (const phrase of [
    "what a model sees for one inference step",
    "knowledge in the model's weights",
    "bounded, versioned view",
    "temporary projection",
  ]) expect(flat).toContain(phrase);
});

test("the context spec pins every behavior-changing transformation", () => {
  for (const field of [
    "model_revision",
    "tokenizer_revision",
    "chat_template_revision",
    "max_input_tokens",
    "max_total_tokens",
    "output_reserve",
    "tool_catalog_revision",
    "retrieval_spec_hash",
    "compaction_policy_revision",
    "ordering_policy_revision",
    "trust_policy_revision",
    "tool_server_identities",
    "retention_policy_revision",
  ]) expect(flat).toContain(field);
});

test("context items retain authority, provenance, and derivation", () => {
  for (const field of [
    "item_id",
    "role, authority",
    "content_hash",
    "source_version",
    "expires_at",
    "tenant, acl_version",
    "derived_from",
    "parent_call_id",
    "mandatory",
  ]) expect(flat).toContain(field);
  expect(flat).toContain("those fields are deliberately separate");
});

test("the token formulation counts the exact serialized request", () => {
  for (const phrase of [
    "\\operatorname{serialize}",
    "w_{\\mathrm{in}}",
    "w_{\\mathrm{total}}",
    "model-specific chat and tool template",
    "output reserve",
    "combined input-and-generation limit",
  ]) expect(flat).toContain(phrase);
});

test("overflow and tool-loop reserves fail explicitly", () => {
  for (const phrase of [
    "headroom for the assistant's tool request",
    "never delegate overflow behavior",
    "fail visibly",
    "silent clipping destroys reproducibility",
    "reconcile the preflight count",
  ]) expect(flat).toContain(phrase);
});

test("in-context learning claims preserve their experimental scope", () => {
  for (const phrase of [
    "varied substantially by task and model size",
    "same four demonstrations",
    "evaluated gpt-family models",
    "inputs to an evaluation, not decoration",
  ]) expect(flat).toContain(phrase);
});

test("distractor and position effects are not universalized", () => {
  for (const phrase of [
    "grade-school arithmetic problems",
    "does not prove that every extra passage lowers quality",
    "multi-document question answering and synthetic key-value retrieval",
    "not a law that every model, task, or context length follows",
    "permutation test",
  ]) expect(flat).toContain(phrase);
});

test("authorization precedes selection and untrusted data stays data", () => {
  for (const phrase of [
    "authorize before selection",
    "keep data as data",
    "surface conflict instead of erasing it",
    "formatting alone is not a security boundary",
    "model specifically trained",
    "least-privilege tools",
  ]) expect(flat).toContain(phrase);
});

test("compaction remains lossy derived state", () => {
  for (const phrase of [
    "lossy state transition",
    "durable truth",
    "working state",
    "ephemeral detail",
    "must not replace them",
    "unresolved uncertainty",
    "reconcile against the external system",
  ]) expect(flat).toContain(phrase);
});

test("MCP standardization does not grant authority", () => {
  for (const phrase of [
    "does not decide which capabilities",
    "host coordinates clients, permissions, consent",
    "does not collapse all trust domains",
    "a valid schema is not permission",
    "link it to the originating call id",
    "annotations supplied by a remote server as hints",
  ]) expect(flat).toContain(phrase);
});

test("the assembly algorithm preserves its security and replay invariants", () => {
  for (const phrase of [
    "authenticated caller",
    "reject items outside",
    "record why every item was kept",
    "never silently truncate mandatory content",
    "reauthorize any proposed tool action",
    "contextmanifest",
  ]) expect(flat).toContain(phrase);
});

test("the manifest distinguishes upstream failures from model non-use", () => {
  for (const phrase of [
    "retrieval failure",
    "authorization filtering",
    "budget exclusion",
    "compaction loss",
    "serialization error",
    "model non-use",
  ]) expect(flat).toContain(phrase);
});

test("evaluation covers policy quality, attacks, continuity, and cost", () => {
  for (const phrase of [
    "current production policy",
    "no-added-context baseline",
    "full-context baseline",
    "oracle",
    "worst relevant position",
    "revoke access",
    "already completed actions are not repeated",
    "manifest coverage",
    "helmet",
  ]) expect(flat).toContain(phrase);
});

test("serving constraints describe cache behavior precisely", () => {
  for (const phrase of [
    "keys and values are reused rather than recomputed",
    "attends over the active cached sequence",
    "exact stable prefix",
    "cache reuse is an optimization, not durable memory",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes unsupported chronology and universal rules", () => {
  for (const phrase of [
    "the field renamed this work",
    "the window is the only channel",
    "the middle is a dead zone",
    "why a bigger window does not help",
    "the only lever left",
    "typically ten to one hundred",
    "mcp's original load-everything design",
    "context overflow truncates silently",
    "rng = np.random.default_rng",
  ]) expect(flat).not.toContain(phrase);
});

test("the bibliography uses archival and official records", () => {
  for (const marker of [
    "proceedings.neurips.cc/paper_files/paper/2020",
    "aclanthology.org/2024.tacl-1.9",
    "aclanthology.org/2022.acl-long.556",
    "proceedings.mlr.press/v202/shi23a.html",
    "openreview.net/forum?id=mljlvignhp",
    "usenix.org/conference/usenixsecurity25",
    "modelcontextprotocol.io/specification/2025-11-25",
    "proceedings.iclr.cc/paper_files/paper/2025",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("stable structure and the evaluation handoff remain", () => {
  expect(chapter).toContain("# Context Engineering {#sec-context-engineering}");
  expect(chapter).toMatch(/## .*contested/i);
  expect(chapter).toMatch(/## .*lower-layer constraint/i);
  expect(chapter).toContain("@sec-benchmarks");
  expect(chapter).toContain('data-family="u-shape"');
  expect(chapter).toContain("::: {#further-reading}");
});

test("the context assembly diagram fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
