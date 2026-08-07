import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/practice/06-retrieval-and-documents.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/retrieval-and-documents.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter begins with a retrieval release contract", () => {
  expect(chapter).toMatch(/^# Retrieval and Document Intelligence \{#sec-retrieval-practice\}/);
  for (const phrase of [
    "retrieval release",
    "corpus boundary",
    "query classes",
    "success evidence",
    "authority",
    "freshness",
    "deletion",
    "latency",
    "cost",
    "rollback",
  ]) expect(flat).toContain(phrase);
});

test("source material remains traceable through every derived representation", () => {
  for (const phrase of [
    "source object",
    "source revision",
    "content digest",
    "rendition",
    "document element",
    "chunk id",
    "embedding model",
    "index snapshot",
    "provenance",
  ]) expect(flat).toContain(phrase);
});

test("ingestion is an explicit publication protocol", () => {
  for (const phrase of [
    "acquire",
    "authorize",
    "malware",
    "normalize",
    "parse",
    "reading order",
    "structured extraction",
    "segment",
    "embed",
    "publish",
    "quarantine",
  ]) expect(flat).toContain(phrase);
});

test("OCR and vision-language parsing are defined locally", () => {
  expect(flat).toContain("@gls-ocr, optical character recognition");
  expect(flat).toContain("recognizes text from pixels");
  expect(flat).toContain("@gls-vlm, a vision-language model");
  expect(flat).toContain("reads page images and text together");
  for (const phrase of ["digital text layer", "layout", "table", "equation", "coordinates"])
    expect(flat).toContain(phrase);
});

test("document evaluation separates structure from transcription", () => {
  for (const phrase of [
    "character error rate",
    "element detection",
    "reading-order",
    "table structure",
    "formula",
    "field-level",
    "document stratum",
    "human review",
  ]) expect(flat).toContain(phrase);
});

test("schema validation is not confused with semantic correctness", () => {
  for (const phrase of [
    "json schema",
    "schema-valid",
    "semantic correctness",
    "unknown",
    "abstain",
    "postcondition",
  ]) expect(flat).toContain(phrase);
});

test("segmentation preserves document structure and citation spans", () => {
  for (const phrase of [
    "retrieval unit",
    "citation unit",
    "parent element",
    "source span",
    "heading path",
    "overlap",
    "duplicate",
    "boundary",
  ]) expect(flat).toContain(phrase);
});

test("visual document retrieval is a measured alternative rather than a shortcut", () => {
  for (const phrase of [
    "visual retrieval",
    "page image",
    "late interaction",
    "text retrieval",
    "multimodal",
    "accessibility",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("skip the parse and nothing upstream caps the retriever");
});

test("the online path authorizes before candidate retrieval", () => {
  for (const phrase of [
    "query contract",
    "verified principal",
    "tenant",
    "access-control",
    "authorize before",
    "candidate generation",
    "current resource state",
  ]) expect(flat).toContain(phrase);
});

test("the authorization predicate is split into mobile-safe rows", () => {
  const equation = [...chapter.matchAll(/\$\$\n([\s\S]*?)\n\$\$/g)]
    .map((match) => match[1])
    .find((body) => body.includes("U(q,s,t,g)"));
  expect(equation).toBeDefined();
  expect(equation).toContain("\\begin{gathered}");
  expect(equation!.match(/\\\\/g)?.length).toBeGreaterThanOrEqual(4);
});

test("retrieval families retain distinct representations and costs", () => {
  for (const phrase of [
    "sparse retrieval",
    "bm25",
    "dense retrieval",
    "dual encoder",
    "late interaction",
    "cross-encoder",
    "precompute",
    "query-document pair",
  ]) expect(flat).toContain(phrase);
});

test("embedding similarity is a versioned compatibility contract", () => {
  for (const phrase of [
    "embedding dimension",
    "normalization",
    "cosine similarity",
    "inner product",
    "distance metric",
    "query prefix",
    "document prefix",
    "re-embed",
  ]) expect(flat).toContain(phrase);
});

test("reciprocal rank fusion is formal and self-contained", () => {
  for (const marker of ["s_{\\mathrm{rrf}}", "r_j(d)", "\\mathcal{L}", "k_0"])
    expect(chapter).toContain(marker);
  for (const phrase of [
    "ranked list",
    "one-based rank",
    "not returned",
    "fusion constant",
    "does not calibrate",
  ]) expect(flat).toContain(phrase);
  for (const delimiter of ["\\(", "\\)", "\\[", "\\]"])
    expect(chapter).not.toContain(delimiter);
});

test("reranking and context selection remain separate decisions", () => {
  for (const phrase of [
    "candidate depth",
    "rerank depth",
    "context budget",
    "top-k",
    "diversity",
    "maximum marginal relevance",
    "latency budget",
  ]) expect(flat).toContain(phrase);
});

test("the index contract covers filtering, persistence, and migration", () => {
  for (const phrase of [
    "index contract",
    "metadata schema",
    "filter selectivity",
    "exact-search baseline",
    "ann recall",
    "hnsw",
    "diskann",
    "shadow index",
    "dual read",
    "atomic",
  ]) expect(flat).toContain(phrase);
});

test("updates and deletions reach every serving surface", () => {
  for (const phrase of [
    "freshness sla",
    "deletion sla",
    "tombstone",
    "vector index",
    "lexical index",
    "cache",
    "snapshot",
    "stale result",
  ]) expect(flat).toContain(phrase);
});

test("answer citations bind claims to retrieved evidence", () => {
  for (const phrase of [
    "evidence id",
    "claim",
    "citation precision",
    "citation recall",
    "entailment",
    "generated citation",
    "source revision",
  ]) expect(flat).toContain(phrase);
});

test("retrieved content stays untrusted and cannot widen authority", () => {
  for (const phrase of [
    "indirect prompt injection",
    "untrusted data",
    "cannot grant authority",
    "tool instruction",
    "data exfiltration",
    "poisoned corpus",
  ]) expect(flat).toContain(phrase);
});

test("evaluation localizes failures instead of collapsing them", () => {
  for (const phrase of [
    "parse quality",
    "recall@k",
    "ndcg@k",
    "mrr",
    "answer correctness",
    "faithfulness",
    "abstention",
    "p95 latency",
    "cost per accepted answer",
    "oracle",
  ]) expect(flat).toContain(phrase);
});

test("the acceptance suite covers realistic negative cases", () => {
  for (const phrase of [
    "wrong tenant",
    "deleted document",
    "stale revision",
    "poisoned chunk",
    "malformed table",
    "empty retrieval",
    "duplicate chunk",
    "index failure",
    "no-answer",
    "rollback",
  ]) expect(flat).toContain(phrase);
});

test("the operating lifecycle ends in a requalifiable release record", () => {
  for (const phrase of [
    "freeze the contract",
    "labeled corpus",
    "lexical baseline",
    "shadow",
    "canary",
    "last-known-good",
    "requalification trigger",
    "retrieval release record",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes volatile catalogs and universal defaults", () => {
  for (const phrase of [
    "as of mid-2026",
    "a sensible default (2026)",
    "pick it when",
    "the boring-safe default",
    "best open default",
    "highest-roi single change",
    "right default for most rag",
    "reported around $2 per 1k pages",
  ]) expect(flat).not.toContain(phrase);
  for (const marker of [
    "fig-retrieval-pipeline",
    "fig-document-lineage",
    "fig-retrieval-query",
    "@sec-rag-retrieval",
    "@sec-context-engineering",
    "@sec-agents-practice",
    "@sec-security-authorization",
    "@sec-serving-stack",
    "@sec-eval-practice",
    "@sec-wiring-stack",
    "::: {#further-reading}",
  ]) expect(chapter).toContain(marker);
});

test("the bibliography uses primary research and official records", () => {
  for (const title of [
    "Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks",
    "Docling Technical Report",
    "OmniDocBench: Benchmarking Diverse PDF Document Parsing",
    "Dense Passage Retrieval for Open-Domain Question Answering",
    "ColBERT: Efficient and Effective Passage Search",
    "ColPali: Efficient Document Retrieval",
    "BEIR: A Heterogeneous Benchmark",
    "MTEB: Massive Text Embedding Benchmark",
    "Reciprocal Rank Fusion Outperforms Condorcet",
    "Hierarchical Navigable Small World",
    "DiskANN: Fast Accurate Billion-point",
    "RAGAs: Automated Evaluation",
    "PoisonedRAG: Knowledge Corruption Attacks",
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

test("the complete chapter renders through its release handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "practice/retrieval-and-documents.html",
    chapterTitle: "Retrieval and Document Intelligence",
    chapterNum: "86",
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
  expect(html).toContain("The output is a retrieval release record");
  expect(headings.some(({ text }) => text.includes("s_{"))).toBeFalse();
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses through the production path and fits mobile", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(3);
  const graphviz = await loadGraphviz();
  const svgs: string[] = [];
  for (const block of blocks) {
    const svg = renderDot(graphviz, block[1], new Map(), "practice/retrieval-and-documents.html", "");
    svgs.push(svg);
    expect(svg).not.toContain("graphviz error");
    const widthPt = Number(svg.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
  for (const label of ["Sparse", "Dense", "Visual"])
    expect(svgs[2], `query diagram should show ${label}`).toContain(`>${label}<`);
});
