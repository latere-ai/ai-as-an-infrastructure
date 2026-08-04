import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/orchestration/09-embeddings-representation.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/embeddings-representation.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter defines an embedding as a bounded scoring contract", () => {
  for (const phrase of [
    "versioned scoring interface",
    "fixed-length vector",
    "nearness does not by itself mean",
    "one ranking contract",
  ]) expect(flat).toContain(phrase);
});

test("the embedding spec makes every compatibility field explicit", () => {
  for (const phrase of [
    "model_revision",
    "tokenizer_revision",
    "query_role",
    "document_role",
    "instruction_version",
    "pooling",
    "truncation_policy",
    "dimension",
    "normalization",
    "similarity",
    "quantization",
    "embedding_spec_hash",
  ]) expect(flat).toContain(phrase);
});

test("similarity and normalization define compatible rankings", () => {
  for (const phrase of [
    "u^\\mathsf{t}v",
    "\\widehat{u}",
    "unit-length vectors",
    "cosine similarity",
    "vector length affects",
    "unnormalized inner product",
  ]) expect(flat).toContain(phrase);
});

test("pooling is an explicit token-to-vector operation", () => {
  for (const phrase of [
    "masked mean pooling",
    "a_t\\in\\{0,1\\}",
    "special-token pooler",
    "max pooling",
    "learned attention",
    "source_layer",
  ]) expect(flat).toContain(phrase);
});

test("anisotropy is scoped as a diagnostic rather than a universal cause", () => {
  for (const phrase of [
    "geometric warning",
    "not proof that anisotropy causes every pooling failure",
    "correcting anisotropy alone",
    "operational test is still ranking quality",
  ]) expect(flat).toContain(phrase);
});

test("InfoNCE defines its batch, temperature, and sampling assumptions", () => {
  for (const phrase of [
    "batch has $b$ labeled pairs",
    "candidate negatives",
    "\\tau>0",
    "particular negative set",
    "mutual-information lower bound",
    "mining proposal",
    "may invalidate",
  ]) expect(flat).toContain(phrase);
});

test("temperature and geometry claims retain their conditions", () => {
  for (const phrase of [
    "diagnostic analogy rather than a theorem",
    "amplifies mislabeled negatives",
    "no task-independent best temperature",
    "score scale changes",
  ]) expect(flat).toContain(phrase);
});

test("interaction architectures state indexability and cost", () => {
  for (const phrase of [
    "dual encoder",
    "late interaction",
    "cross-encoder",
    "what can be indexed",
    "maxsim",
    "uncompressed late-interaction index",
  ]) expect(flat).toContain(phrase);
});

test("training labels and negatives preserve provenance and uncertainty", () => {
  for (const phrase of [
    "training data defines relevance",
    "label origin and confidence",
    "deduplication group",
    "unjudged",
    "not known to be irrelevant",
    "hard false negative",
    "human judgment",
  ]) expect(flat).toContain(phrase);
});

test("synthetic data and distillation retain their limits", () => {
  for (const phrase of [
    "synthetic generation",
    "generator revisions",
    "source rights",
    "distillation inherits the teacher's bias",
    "candidate set the teacher sees",
  ]) expect(flat).toContain(phrase);
});

test("instructions and Matryoshka prefixes are versioned interfaces", () => {
  for (const phrase of [
    "exact instruction template",
    "trained prefix dimensions",
    "independently normalized",
    "only trained dimensions are promised",
    "multiple training losses are not literally free",
  ]) expect(flat).toContain(phrase);
});

test("index migration rejects incompatible vectors", () => {
  for (const phrase of [
    "new index generation",
    "do not compare query vectors from one model",
    "build the replacement beside the current index",
    "exact vector rankings",
    "ann loss",
    "rollback window",
  ]) expect(flat).toContain(phrase);
});

test("derived vectors inherit security and deletion policy", () => {
  for (const phrase of [
    "derived content, not anonymized content",
    "authorization",
    "retention",
    "deletion policy",
    "tenant",
    "provider logs",
  ]) expect(flat).toContain(phrase);
});

test("evaluation separates representation, indexing, operations, and answers", () => {
  for (const phrase of [
    "exact-search recall@k",
    "ann recall against exact neighbors",
    "worst material slice",
    "query encoding latency",
    "migration duration",
    "bootstrap confidence intervals",
    "answer quality",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes unsupported universal and leaderboard claims", () => {
  for (const phrase of [
    "generator's hidden states make a poor metric space",
    "negatives are the central training variable",
    "the positive is given",
    "directly raises retrieval quality",
    "commonly near $0.05$ to $0.1$",
    "any prefix of its dimensions",
    "tops the multilingual benchmark",
    "leading the multilingual leaderboard by 2026",
  ]) expect(flat).not.toContain(phrase);
});

test("the literature trail points to archival primary sources", () => {
  for (const marker of [
    "aclanthology.org/d19-1410",
    "aclanthology.org/2020.emnlp-main.550",
    "proceedings.mlr.press/v119/wang20k.html",
    "aclanthology.org/2022.naacl-main.272",
    "proceedings.neurips.cc/paper_files/paper/2022",
    "aclanthology.org/2023.eacl-main.148",
    "proceedings.iclr.cc/paper_files/paper/2025",
    "aclanthology.org/2025.naacl-long.597",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("stable structure and the context-engineering handoff remain", () => {
  expect(chapter).toContain(
    "# Embeddings and Representation Learning {#sec-embeddings}",
  );
  expect(chapter).toMatch(/## .*contested/i);
  expect(chapter).toMatch(/## .*(constraint arrow|lower-layer constraint)/i);
  expect(chapter).toContain("@sec-context-engineering");
  expect(chapter).toContain('data-viz="infonce-field"');
  expect(chapter).toContain("::: {#further-reading}");
});

test("inline embedding diagrams fit the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
