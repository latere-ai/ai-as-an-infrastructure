import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/orchestration/08-rag-retrieval.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/rag-retrieval.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter defines RAG as an evidence supply chain, not a truth guarantee", () => {
  for (const phrase of [
    "evidence supply chain",
    "does not make the answer true",
    "retrieval cannot recover",
    "generation cannot recover",
    "abstain",
  ]) expect(flat).toContain(phrase);
});

test("ingestion preserves identity, provenance, versions, and deletion", () => {
  for (const phrase of [
    "document_id",
    "chunk_id",
    "content_hash",
    "source_uri",
    "source_version",
    "acl",
    "valid_from",
    "valid_until",
    "parser_version",
    "chunker_version",
    "embedding_model_version",
    "index_version",
    "tombstone",
  ]) expect(flat).toContain(phrase);
});

test("the online request is bound to identity, scope, and budgets", () => {
  for (const phrase of [
    "retrievalrequest",
    "authenticated principal",
    "tenant",
    "corpus scope",
    "freshness bound",
    "latency budget",
    "token budget",
  ]) expect(flat).toContain(phrase);
});

test("candidate generation keeps sparse and dense retrieval complementary", () => {
  for (const phrase of [
    "bm25",
    "inverted index",
    "dual-encoder",
    "approximate nearest neighbor",
    "hnsw",
    "domain shift",
    "hybrid",
  ]) expect(flat).toContain(phrase);
});

test("the BM25 equation keeps its multiplication operator", () => {
  const bm25 = chapter.match(
    /s_\{\\mathrm\{BM25\}\}[\s\S]*?\\end\{aligned\}/,
  )?.[0];
  expect(bm25).toBeDefined();
  expect(bm25).toContain("{}\\times");
  expect(bm25).not.toContain("\t");
});

test("rank fusion and reranking define their contracts and limits", () => {
  for (const phrase of [
    "reciprocal rank fusion",
    "rank_r(d)",
    "stable document identity",
    "cross-encoder",
    "colbert",
    "candidate recall ceiling",
  ]) expect(flat).toContain(phrase);
});

test("authorization constrains the searchable set and fails closed", () => {
  for (const phrase of [
    "authorized candidate set",
    "authorization is not a ranking feature",
    "prefilter",
    "postfilter",
    "fail closed",
    "revocation",
    "cache key",
  ]) expect(flat).toContain(phrase);
});

test("context packing and citations preserve exact evidence", () => {
  for (const phrase of [
    "context packing",
    "claimsource",
    "quoted span",
    "source version",
    "citation precision",
    "citation recall",
    "contradictory evidence",
  ]) expect(flat).toContain(phrase);
});

test("retrieved material remains untrusted data", () => {
  for (const phrase of [
    "untrusted data, not instructions",
    "prompt injection",
    "corpus poisoning",
    "cannot grant tool authority",
    "source trust",
  ]) expect(flat).toContain(phrase);
});

test("adaptive retrieval is bounded and compared with simpler baselines", () => {
  for (const phrase of [
    "query decomposition",
    "stop condition",
    "maximum rounds",
    "graph-based retrieval",
    "single-shot baseline",
    "compute-matched",
  ]) expect(flat).toContain(phrase);
});

test("long context and retrieval are evaluated as alternatives and complements", () => {
  for (const phrase of [
    "long-context baseline",
    "position sensitivity",
    "corpus exceeds",
    "per-query cost",
    "route",
  ]) expect(flat).toContain(phrase);
});

test("evaluation localizes failure across the full pipeline", () => {
  for (const phrase of [
    "recall@k",
    "ndcg@k",
    "packing recall",
    "oracle-context",
    "no-retrieval baseline",
    "bootstrap confidence interval",
    "index age",
    "unauthorized-result rate",
    "poisoning success rate",
  ]) expect(flat).toContain(phrase);
});

test("the evidence trail uses archival papers and official documentation", () => {
  for (const marker of [
    "proceedings.neurips.cc/paper/2020",
    "aclanthology.org/2020.emnlp-main.550",
    "datasets-benchmarks-proceedings.neurips.cc",
    "usenix.org/conference/usenixsecurity25",
    "aclanthology.org/2024.tacl-1.9",
    "learn.microsoft.com/en-us/azure/search/vector-search-filters",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("the rewrite removes unsupported universal and vendor-specific claims", () => {
  for (const phrase of [
    "the hard parts are all in the retrieval",
    "exact nearest neighbor is correct and too slow",
    "that cost is usually worth it",
    "first dozen reranked candidates",
    "most production traffic does not need",
    "benefits enormously",
    "the funnel remains the only way in",
    "main defense against the confident hallucination",
  ]) expect(flat).not.toContain(phrase);
});

test("stable structure and the embeddings handoff remain", () => {
  expect(chapter).toContain("# RAG and Retrieval {#sec-rag-retrieval}");
  expect(chapter).toMatch(/## .*contested/i);
  expect(chapter).toMatch(/## .*(constraint arrow|lower-layer constraint)/i);
  expect(chapter).toContain("@sec-embeddings");
  expect(chapter).toContain("::: {#further-reading}");
});

test("inline retrieval diagrams fit the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
