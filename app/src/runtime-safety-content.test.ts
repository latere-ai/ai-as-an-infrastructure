import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/safety/04-runtime-safety.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/runtime-safety.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening defines runtime safety as an enforced request contract", () => {
  for (const phrase of [
    "runtime safety is the request-time contract",
    "detects evidence",
    "policy decides",
    "enforcement point",
    "contains what still goes wrong",
    "records what happened",
    "the model may propose; only trusted code may authorize and commit",
  ]) expect(flat).toContain(phrase);
});

test("detection, decision, enforcement, containment, and evidence remain distinct", () => {
  for (const phrase of [
    "detector",
    "policy decision",
    "policy enforcement",
    "containment",
    "evidence",
    "a score is not a decision",
    "a decision is not enforcement",
    "a blocked request is not proof that no side effect occurred",
  ]) expect(flat).toContain(phrase);
});

test("the moderation decision is formally defined with an abstention region", () => {
  for (const phrase of [
    "let $x$ be the content being evaluated",
    "let $k$ identify a harm category",
    "lower threshold",
    "upper threshold",
    "allow, review, or block",
    "let $v$ identify the policy revision",
    "estimated score is not automatically a probability",
    "calibrated on traffic that represents the deployment",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/D_v\(x,k\)\s*&?=/);
  expect(chapter).toMatch(/\\tau_\{\\mathrm\{allow\},k\}/);
  expect(chapter).toMatch(/\\tau_\{\\mathrm\{block\},k\}/);
});

test("moderation limits are explicit rather than hidden behind one threshold", () => {
  for (const phrase of [
    "false negative",
    "false positive",
    "base rate",
    "distribution shift",
    "calibration",
    "abstain",
    "per category",
    "per language",
    "adversarial test set",
  ]) expect(flat).toContain(phrase);
});

test("policy as input is scoped to what the classifier actually supports", () => {
  for (const phrase of [
    "policy text does not make an unsupported category reliable",
    "versioned policy bundle",
    "schema validation",
    "evaluation before rollout",
    "rollback",
    "policy prompt is untrusted configuration until validated",
  ]) expect(flat).toContain(phrase);
});

test("prompt injection is modeled as untrusted data influencing privileged effects", () => {
  for (const phrase of [
    "untrusted data can influence a privileged decision",
    "direct prompt injection",
    "indirect prompt injection",
    "successful injection is not yet a successful exploit",
    "accepted by the enforcement point",
    "trusted instructions and untrusted data",
  ]) expect(flat).toContain(phrase);
});

test("learned prompt-injection defenses are separated from structural controls", () => {
  for (const phrase of [
    "instruction hierarchy",
    "spotlighting",
    "learned defenses",
    "do not establish a security boundary",
    "control flow",
    "data flow",
    "least privilege",
    "human confirmation",
  ]) expect(flat).toContain(phrase);
});

test("tool effects cross deterministic gates outside the model", () => {
  for (const phrase of [
    "typed tool schema",
    "canonical parameters",
    "authorization",
    "destination policy",
    "secret broker",
    "idempotency key",
    "write-ahead intent",
    "effect receipt",
    "redirect target",
    "dns answer",
  ]) expect(flat).toContain(phrase);
});

test("sandboxing and egress controls have bounded claims", () => {
  for (const phrase of [
    "sandbox limits consequences; it does not decide whether an action is appropriate",
    "seccomp",
    "namespaces",
    "cgroups",
    "container is not a virtual machine",
    "network egress",
    "fail closed for privileged effects",
    "resource limits",
  ]) expect(flat).toContain(phrase);
});

test("streaming distinguishes display text from executable output", () => {
  for (const phrase of [
    "already disclosed",
    "buffer executable outputs",
    "tool call",
    "url",
    "streaming text",
    "committed side effect",
    "incremental moderation",
  ]) expect(flat).toContain(phrase);
});

test("the operating contract is explicit and testable", () => {
  for (const field of [
    "request_id",
    "policy_revision",
    "input_provenance",
    "detector_revision_and_scores",
    "decision_and_thresholds",
    "tool_schema_revision",
    "authorization_decision_id",
    "canonical_action_and_parameters",
    "sandbox_profile",
    "egress_decision",
    "approval_binding",
    "effect_idempotency_key",
    "effect_receipt",
    "failure_mode",
  ]) expect(flat).toContain(field);
});

test("regression scenarios cover moderation and effect enforcement", () => {
  for (const phrase of [
    "guard timeout",
    "policy rollback",
    "split encoding",
    "unknown tool field",
    "redirect to a blocked host",
    "dns rebinding",
    "approval replay",
    "duplicate delivery",
    "cross-tenant",
    "partial stream",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toContain("# Runtime Safety: Guardrails and Moderation {#sec-runtime-safety}");
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  for (const ref of [
    "@sec-the-harness",
    "@sec-security-authorization",
    "@sec-oversight-control",
    "@sec-adversarial-robustness",
    "@sec-serving-problem",
  ]) expect(chapter).toContain(ref);
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography includes primary research and official isolation guidance", () => {
  for (const marker of [
    "10.6028/nist.ai.600-1",
    "10.6028/nist.sp.800-190",
    "kernel.org/doc/html/latest/userspace-api/seccomp_filter.html",
    "proceedings.mlr.press/v70/guo17a.html",
    "papers.nips.cc/paper_files/paper/2017",
    "aclanthology.org/2024.findings-acl.624",
    "arxiv.org/abs/2503.18813",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("every literature citation resolves to a local bibliography entry", () => {
  const keys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  for (const key of keys) {
    expect(bibliography).toMatch(new RegExp(`@[^{]+\\{${key},`, "i"));
  }
});

test("categorical and machine-like legacy claims are absent", () => {
  expect(chapter).not.toContain("/figures/runtime-safety-1.svg");
  for (const phrase of [
    "the lineage runs from crude to programmable",
    "the decisive shift",
    "the frontier of the field",
    "the one approach that offers a guarantee",
    "the precondition for catastrophe",
    "the guard is becoming",
    "the standard response is the one control theory and security both reach for",
    "a single jailbreak does not compromise both",
    "the risk is sharpest",
    "good intentions",
  ]) expect(flat).not.toContain(phrase);
});

test("hard wraps do not split hyphenated compounds in rendered prose", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("math uses delimiters supported by the book renderer", () => {
  for (const delimiter of ["\\(", "\\)", "\\[", "\\]"]) {
    expect(chapter).not.toContain(delimiter);
  }
  expect(chapter).toContain("$$\n\\begin{aligned}");
});

test("moderation decision branches split into mobile-safe displays", () => {
  for (const decision of ["allow", "review", "block"]) {
    expect(chapter).toMatch(
      new RegExp("D_v\\(x,k\\)\\s*&=\\s*\\\\mathrm\\{" + decision + "\\}"),
    );
  }
  expect(chapter).not.toContain("\\begin{cases}");
});

test("every Graphviz figure fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
