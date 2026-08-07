import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/ecosystem/08-agent-economy.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/ecosystem/08-agent-economy.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/agent-economy.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis treats agent commerce as a transaction path", () => {
  for (const phrase of [
    "transaction path",
    "not a new legal person",
    "identity does not prove authority",
    "authority does not prove intent",
    "payment does not prove delivery",
  ]) expect(flat).toContain(phrase);
});

test("roles and independently enforced decisions are explicit", () => {
  for (const phrase of [
    "principal",
    "agent workload",
    "merchant or resource server",
    "authorization server",
    "payment provider",
    "settlement network",
    "independently",
    "local policy",
  ]) expect(flat).toContain(phrase);
});

test("agent authentication is not confused with user delegation", () => {
  for (const phrase of [
    "rfc 9421",
    "http message signatures",
    "web bot auth",
    "internet-draft",
    "end-user authentication is out of scope",
    "rfc 8693",
    "token exchange",
    "rfc 9396",
    "rich authorization requests",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("oauth identifies a client application, not a specific agent");
  expect(flat).not.toContain("built on cloudflare's web bot auth");
});

test("a mandate is a bounded instruction rather than proof of truth", () => {
  for (const phrase of [
    "principal",
    "audience",
    "action",
    "maximum amount",
    "currency",
    "expiry",
    "approval",
    "redelegation",
    "nonce",
    "revocation",
    "does not prove",
    "business rules",
  ]) expect(flat).toContain(phrase);
});

test("protocols are mapped by function without implying a universal stack", () => {
  for (const phrase of [
    "checkout coordination",
    "transaction evidence",
    "agent recognition",
    "payment request",
    "settlement",
    "acp",
    "ucp",
    "ap2",
    "tap",
    "x402",
  ]) expect(flat).toContain(phrase);
  for (const overclaim of [
    "three rails the web never built",
    "first at-scale deployment",
    "completing a stack",
    "no single company owns more than a slice",
  ]) expect(flat).not.toContain(overclaim);
});

test("micropayment equations use defined symbols and compatible units", () => {
  const compact = chapter.replace(/\s+/g, "");
  for (const marker of [
    "o_{\\mathrm{agent}}(n)",
    "\\frac{c_m}{n}+c_a",
    "m_n",
    "p(1-r)-\\frac{f}{n}-c",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "same unit",
    "same accounting horizon",
    "mandate cost",
    "per-purchase agent cost",
    "percentage fee",
    "fixed fee",
    "fulfillment cost",
  ]) expect(flat).toContain(phrase);
  expect(chapter).not.toContain("human irrational, agent fine");
});

test("x402 is described as a protocol rather than an economic guarantee", () => {
  for (const phrase of [
    "payment-required",
    "payment-signature",
    "payment-response",
    "resource server",
    "facilitator",
    "network, token, and currency",
    "does not guarantee demand",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("signed stablecoin payment in a header");
  expect(flat).not.toContain("proof that machine-granularity settlement clears at all");
});

test("transaction state preserves uncertain and compensating outcomes", () => {
  for (const phrase of [
    "denied",
    "payment required",
    "authorized",
    "settled",
    "fulfilled",
    "failed",
    "unknown",
    "refunded",
    "disputed",
    "idempotency",
    "replay",
    "reconciliation",
  ]) expect(flat).toContain(phrase);
});

test("adoption evidence is bounded and incompatible vendor metrics are removed", () => {
  for (const phrase of [
    "protocol publication",
    "not production adoption",
    "internal experiment",
    "186 deals",
    "just over $4,000",
    "does not establish",
  ]) expect(flat).toContain(phrase);
  for (const overclaim of [
    "one hundred million payments",
    "a trillion dollars",
    "over a fifth of global holiday retail sales",
  ]) expect(flat).not.toContain(overclaim);
});

test("the operating contract covers control, evidence, and recovery", () => {
  for (const phrase of [
    "reserve",
    "commit",
    "release",
    "exactly-once",
    "effect receipt",
    "payment status",
    "fulfillment status",
    "refund",
    "dispute",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toContain("# The Agent Economy: Identity, Delegation, and Machine Payments {#sec-agent-economy}");
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  expect(chapter).toContain("fig-agent-economy-landscape");
  for (const ref of [
    "@sec-security-authorization",
    "@sec-runtime-safety",
    "@sec-economics",
    "@sec-market-structure",
    "@sec-data-rights-economics",
  ]) expect(chapter).toContain(ref);
});

test("the bibliography favors current primary specifications", () => {
  for (const marker of [
    "rfc-editor.org/rfc/rfc8693.html",
    "rfc-editor.org/rfc/rfc9396.html",
    "rfc-editor.org/rfc/rfc9421.html",
    "datatracker.ietf.org/doc/draft-meunier-webbotauth-httpsig-protocol",
    "github.com/x402-foundation/x402",
    "ap2-protocol.org/ap2/specification",
    "github.com/agentic-commerce-protocol/agentic-commerce-protocol",
    "ucp.dev/2026-04-08/specification/overview",
    "github.com/visa/trusted-agent-protocol",
  ]) expect(bibliography.toLowerCase()).toContain(marker);

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z][a-z0-9]*)/gi)]
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

test("the complete chapter renders through its final handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/agent-economy.html",
    chapterTitle: "The Agent Economy: Identity, Delegation, and Machine Payments",
    chapterNum: "80",
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
  expect(html).toContain("A paying agent is a transaction path");
  expect(html.match(/<figure/g)?.length).toBe(1);
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(1);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});

test("hard wraps do not split hyphenated compounds", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});
