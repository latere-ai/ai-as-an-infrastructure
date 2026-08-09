import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/ecosystem/07-data-rights-economics.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/ecosystem/07-data-rights-economics.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/data-rights-economics.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("rights-readiness is a bounded release decision", () => {
  for (const phrase of [
    "not a property of the bytes",
    "data snapshot",
    "proposed use",
    "actor",
    "jurisdiction",
    "release",
    "review date",
    "not legal advice",
  ]) expect(flat).toContain(phrase);
});

test("the ledger separates facts, legal analysis, policy, controls, and evidence", () => {
  for (const phrase of [
    "source facts",
    "legal decision",
    "organizational policy",
    "technical control",
    "release evidence",
    "legal basis",
    "rights reservation",
    "risk acceptance",
  ]) expect(flat).toContain(phrase);
});

test("the admission predicate is complete and every symbol is defined", () => {
  const compact = chapter.replace(/\s+/g, "");
  for (const marker of [
    "\\operatorname{Admit}(a,u,j,r,t)",
    "P(a)",
    "B(a,u,j,t)",
    "O(a,u,j,t)",
    "C(a,u,j,r,t)",
    "E(a,u,j,r,t)",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "asset snapshot",
    "proposed use",
    "jurisdiction",
    "model or product release",
    "review time",
    "organizational release gate",
    "not a universal legal test",
  ]) expect(flat).toContain(phrase);
});

test("web signals and legal instruments are not collapsed into consent", () => {
  for (const phrase of [
    "robots exclusion protocol",
    "not access authorization",
    "terms of service",
    "copyright",
    "license",
    "privacy consent",
    "access control",
    "not interchangeable",
  ]) expect(flat).toContain(phrase);
});

test("the evidence audits retain their measured boundaries", () => {
  for (const phrase of [
    "more than 1,800 text datasets",
    "more than 70 percent",
    "more than 50 percent",
    "14,000 web domains",
    "45 percent of c4",
    "if respected or enforced",
    "observed signals",
    "not legal conclusions",
  ]) expect(flat).toContain(phrase);
});

test("rights economics uses one accounting horizon and compatible units", () => {
  const compact = chapter.replace(/\s+/g, "");
  for (const marker of [
    "NB_H(D)",
    "\\DeltaV_H(D)",
    "C_{\\mathrm{license}}(D)",
    "C_{\\mathrm{clear}}(D)",
    "C_{\\mathrm{control}}(D)",
    "C_{\\mathrm{evidence}}(D)",
    "C_{\\mathrm{monitor}}(D)",
    "\\mathbb{E}[\\DeltaL_H(D)]",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "same currency",
    "accounting horizon",
    "baseline",
    "license fee is not",
    "per-token price",
    "double counting",
    "guardrails",
  ]) expect(flat).toContain(phrase);
});

test("the net-benefit equation uses mobile-safe rows", () => {
  const equation = chapter.match(/NB_H\(D\)[\s\S]*?\\end\{aligned\}/)?.[0] ?? "";
  const rows = equation.split(/\\\\\s*\n/);
  expect(rows.length).toBeGreaterThanOrEqual(7);
  for (const row of rows) expect(row.replace(/\s+/g, " ").length).toBeLessThanOrEqual(52);
});

test("market evidence is presented as a contract bundle, not a benchmark price", () => {
  for (const phrase of [
    "$203.0 million",
    "two- to three-year",
    "$66.4 million",
    "substantially all",
    "one partner",
    "not a unit price",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("reddit licensing its corpus to google for roughly 60 million dollars a year");
  expect(flat).not.toContain("250 million dollars over five years");
});

test("US copyright decisions are scoped to facts, posture, and jurisdiction", () => {
  for (const phrase of [
    "district-court",
    "procedural posture",
    "lawfully acquired",
    "market harm",
    "settlement is not precedent",
    "do not establish a universal rule",
  ]) expect(flat).toContain(phrase);
  for (const overclaim of [
    "liability landed on acquisition provenance",
    "largest copyright settlement in us history",
    "put a first number",
  ]) expect(flat).not.toContain(overclaim);
});

test("current EU duties and dates are described precisely", () => {
  for (const phrase of [
    "article 53",
    "technical documentation",
    "downstream providers",
    "copyright policy",
    "training-content summary",
    "2 august 2025",
    "2 august 2026",
    "2 august 2027",
    "regulation (eu) 2026/1744",
    "did not postpone",
    "voluntary compliance tool",
  ]) expect(flat).toContain(phrase);
});

test("open source status does not imply publication of the training dataset", () => {
  for (const phrase of [
    "use, study, modify, and share",
    "data information",
    "substantially equivalent system",
    "does not necessarily require publication of the training dataset",
    "does not settle",
  ]) expect(flat).toContain(phrase);
});

test("the operating ledger covers uses, obligations, evidence, and change", () => {
  for (const phrase of [
    "pretraining",
    "fine-tuning",
    "evaluation",
    "retrieval",
    "display",
    "logging",
    "synthetic",
    "territory",
    "duration",
    "attribution",
    "redistribution",
    "indemnity",
    "deletion",
    "termination",
    "source terms change",
    "new market",
    "vendor change",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toContain("# Data Rights and Compliance Economics {#sec-data-rights-economics}");
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  expect(chapter).toContain("fig-data-rights-ledger");
  expect(chapter).not.toContain("data-rights-economics-1.svg");
  for (const ref of [
    "@sec-data-curation",
    "@sec-privacy-provenance",
    "@sec-law-policy",
    "@sec-market-structure",
  ]) expect(chapter).toContain(ref);
});

test("the bibliography uses primary and archival sources", () => {
  for (const marker of [
    "rfc-editor.org/rfc/rfc9309",
    "eur-lex.europa.eu/eli/dir/2019/790/oj",
    "sec.gov/Archives/edgar/data/1713445",
    "govinfo.gov/content/pkg/USCOURTS-cand-3_24-cv-05417",
    "eur-lex.europa.eu/eli/reg/2024/1689/oj",
    "eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:32026R1744",
    "opensource.org/ai/open-source-ai-definition",
  ]) expect(bibliography).toContain(marker);

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

test("the shared bibliography keeps citations used by the Chinese chapter", () => {
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
    currentHref: "ecosystem/data-rights-economics.html",
    chapterTitle: "Data Rights and Compliance Economics",
    chapterNum: "79",
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
  expect(html).toContain("Technically reachable data is not automatically rights-ready");
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
