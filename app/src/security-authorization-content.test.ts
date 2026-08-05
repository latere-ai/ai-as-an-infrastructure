import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/safety/03-security-authorization.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/security-authorization.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening separates authentication, authorization, credentials, and evidence", () => {
  for (const phrase of [
    "authentication establishes claims about the caller",
    "authorization decides whether a specific subject may perform a specific action on a specific resource under the current context",
    "a credential carries claims or grants; it is not the policy itself",
    "@gls-prompt-injection, an instruction hidden in untrusted content",
    "can make an agent request an action",
    "cannot create authority that the enforcement point does not grant",
    "approval is an authorization input",
    "audit is evidence after the decision",
  ]) expect(flat).toContain(phrase);
});

test("the GitHub MCP incident is presented as a scoped proof of concept", () => {
  for (const phrase of [
    "invariant labs",
    "proof-of-concept",
    "malicious public issue",
    "private-repository",
    "personal access token",
    "attack preconditions",
    "not a universal property of mcp",
    "defense in depth",
  ]) expect(flat).toContain(phrase);
});

test("an authorization query and decision are formally defined", () => {
  for (const phrase of [
    "subject s",
    "action a",
    "resource r",
    "context c",
    "policy revision v",
    "allow, deny, or challenge",
    "unknown or missing inputs deny by default",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/q\s*&?=\s*\(s,a,r,c\)/);
  expect(chapter).toMatch(/d\s*&?=\s*P_v\(q\),\s*\\\\/);
  expect(chapter).toMatch(/d\s*&?\\in\s*\\\{\\mathrm\{allow\},\\mathrm\{deny\},\\mathrm\{challenge\}\\\}/);
});

test("effective authority is the intersection of independently verified grants", () => {
  for (const phrase of [
    "same universe of action-resource-context tuples",
    "user grant",
    "agent grant",
    "workload grant",
    "resource policy",
    "runtime constraints",
    "intersection can only remove authority",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/\\mathcal\{E\}\s*=\{?\}&?\\mathcal\{G\}_\{\\mathrm\{user\}\}\s*\\cap\s*\\mathcal\{G\}_\{\\mathrm\{agent\}\}\s*\\cap\s*\\mathcal\{G\}_\{\\mathrm\{workload\}\}/);
});

test("wide authorization equations split for the mobile reading column", () => {
  expect(chapter).toMatch(/q\s*&=\s*\(s,a,r,c\),\s*\\\\/);
  expect(chapter).toMatch(/P_v\(q\),\s*\\\\\s*d\s*&\\in/);
  expect(chapter).toMatch(/\\mathcal\{G\}_\{\\mathrm\{workload\}\}\s*\\\\/);
});

test("subject claims preserve user, agent, workload, tenant, and delegation provenance", () => {
  for (const phrase of [
    "user identity",
    "agent or session revision",
    "workload identity",
    "tenant binding",
    "delegation chain",
    "does not prove user intent",
    "authenticated claim",
    "not from an untrusted request header",
  ]) expect(flat).toContain(phrase);
});

test("policy decisions and effect enforcement are separate and completely mediated", () => {
  for (const phrase of [
    "policy decision point",
    "policy enforcement point",
    "complete mediation",
    "authorize every external effect",
    "canonical action",
    "canonical resource",
    "time-of-check",
    "time-of-use",
    "fail closed",
  ]) expect(flat).toContain(phrase);
});

test("delegation is attenuated without confusing inherited and service authority", () => {
  for (const phrase of [
    "delegated authority",
    "child grant",
    "subset of the parent grant",
    "only the inherited delegation",
    "service's independent authority",
    "must not be forwarded",
    "token exchange does not by itself preserve the user's policy",
    "actor and subject",
  ]) expect(flat).toContain(phrase);
});

test("token controls have explicit and non-equivalent guarantees", () => {
  for (const phrase of [
    "bearer token",
    "sender-constrained",
    "audience-restricted",
    "proof of possession",
    "resource indicator",
    "short lifetime limits exposure",
    "does not provide immediate revocation",
    "token introspection",
    "revocation list",
    "reference token",
  ]) expect(flat).toContain(phrase);
});

test("MCP authorization requirements retain their actual scope", () => {
  for (const phrase of [
    "authorization is optional for mcp implementations",
    "http-based protected server",
    "oauth protected resource metadata",
    "rfc 8707",
    "canonical server uri",
    "does not stop prompt injection",
    "does not decide whether a tool action is appropriate",
  ]) expect(flat).toContain(phrase);
});

test("credential custody is separated from API-level authorization", () => {
  for (const phrase of [
    "model context",
    "generated code",
    "credential broker",
    "opaque handle",
    "destination allowlist",
    "host restriction is not api-level authorization",
    "static secret",
    "tls termination",
  ]) expect(flat).toContain(phrase);
});

test("human approval is bound to the exact effect rather than a natural-language summary", () => {
  for (const phrase of [
    "exact action, resource, and canonical parameters",
    "one-time challenge",
    "expires",
    "approval cannot be reused",
    "provenance",
    "human approval does not repair a misleading preview",
  ]) expect(flat).toContain(phrase);
});

test("tenant isolation is defense in depth, not a substitute for authorization", () => {
  for (const phrase of [
    "tenant is part of the authenticated subject and resource",
    "row-level policy",
    "namespace isolation",
    "physical isolation",
    "defense in depth",
    "does not replace authorization",
    "cross-tenant negative tests",
  ]) expect(flat).toContain(phrase);
});

test("the operating contract records request, decision, enforcement, and effect", () => {
  for (const field of [
    "authorization_request_id",
    "subject_claims_and_provenance",
    "agent_model_tool_revisions",
    "delegation_chain",
    "action_resource_and_canonical_parameters",
    "tenant_and_data_classification",
    "policy_bundle_revision",
    "decision_obligations_and_reason",
    "approval_challenge_and_binding",
    "credential_audience_scope_sender_and_expiry",
    "enforcement_point_and_result",
    "budget_reservation_and_reconciliation",
    "effect_idempotency_key",
    "revocation_and_failure_mode",
    "audit_evidence_and_retention",
  ]) expect(flat).toContain(field);
  expect(flat).toContain("decision record is not proof that the external effect occurred");
});

test("stable structure, interactive explanations, and cross-layer handoffs remain", () => {
  expect(chapter).toContain("# Security and Authorization {#sec-security-authorization}");
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain('data-viz="blast-radius"');
  expect(chapter).toContain('data-viz="stepper"');
  for (const ref of [
    "@sec-the-harness",
    "@sec-rag-retrieval",
    "@sec-multi-agent-systems",
    "@sec-oversight-control",
    "@sec-runtime-safety",
  ]) expect(chapter).toContain(ref);
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography uses primary standards and archival sources", () => {
  for (const marker of [
    "nist.sp.800-207",
    "ndss-symposium.org",
    "rfc-editor.org/rfc/rfc8693",
    "rfc-editor.org/rfc/rfc8707",
    "rfc-editor.org/rfc/rfc9700",
    "modelcontextprotocol.io/specification/2026-07-28/basic/authorization",
    "spiffe.io/docs",
    "openid.net/specs/authorization-api-1_0.html",
    "invariantlabs.ai/blog/mcp-github-vulnerability",
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

test("synthetic evidence and categorical legacy framing are absent", () => {
  expect(chapter).not.toContain(":::: {.runnable}");
  expect(chapter).not.toContain("/figures/security-authorization-1.svg");
  for (const phrase of [
    "equals a breach",
    "the attack surface is the scope list",
    "two fabrics, one verb",
    "three identities, not a hierarchy",
    "the only questions an investigation asks",
    "governance treats the agent as a document, not a running process",
    "moved steadily from broad and durable toward narrow and ephemeral",
    "standard for anything multi-replica",
    "long-ttl tokens and a right to immediate revocation are mutually exclusive",
    "partitioning is safe",
    "a thin market is what an under-served primitive looks like",
    "the $47,000 agent loop",
    "1.67 billion tokens",
  ]) expect(flat).not.toContain(phrase);
});

test("hard wraps do not split hyphenated compounds in rendered prose", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
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
