import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/evaluation/05-factuality-grounding.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/factuality-grounding.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening separates truth, grounding, and citation support", () => {
  for (const phrase of [
    "can be true without being grounded",
    "grounded in a mistaken source without being true",
    "citations that support none of its claims",
    "calling all of them “hallucination” hides the decision",
    "a claim together with its evidence boundary, status, and provenance",
  ]) expect(flat).toContain(phrase);
});

test("the target axes remain distinct and reference-bound", () => {
  for (const phrase of [
    "the benchmark's accepted answers and population",
    "a world-state or reference policy",
    "the supplied context, even if it is incomplete or wrong",
    "attached source spans under an annotation policy",
    "factuality is broader and must name an authority and time",
    "attribution is not a proof of truth",
    "unsupported” means the evaluator did not find sufficient support",
  ]) expect(flat).toContain(phrase);
});

test("the factuality instrument freezes every evidence boundary", () => {
  for (const field of [
    "failure_costs",
    "case_population",
    "as_of_time",
    "closed_book",
    "supplied_context",
    "bounded_search",
    "corpus_snapshot",
    "access_and_source_policy",
    "claim_policy_and_revision",
    "retrieval_and_span_policy",
    "verdict_policy_and_judge",
    "citation_mapping_policy",
    "abstention_policy",
    "aggregation_policy",
    "candidate_evidence_spans",
    "cited_evidence_spans",
    "extractor_revision",
    "retriever_revision",
    "judge_revision",
    "raw_verdict",
    "adjudication",
  ]) expect(flat).toContain(field);
  expect(flat).toContain("results from these modes are not interchangeable");
  expect(flat).toContain("regrading appends a new verdict");
});

test("claim scoring is conditional on decomposition and knowledge source", () => {
  for (const phrase of [
    "fever labeled claims against a fixed wikipedia snapshot",
    "the last label does not assert falsity",
    "measuring factual precision against a knowledge source",
    "c(y)=(c_1,\\ldots,c_m)",
    "f_k(y)",
    "relative to knowledge source $k$",
    "record evidence retrieval separately from the support label",
    "when $m=0$, the score is undefined",
  ]) expect(flat).toContain(phrase);
});

test("atomicity preserves context and remains auditable", () => {
  for (const phrase of [
    "a self-contained statement conveying one independently checkable piece",
    "atomicity is a protocol choice, not a unique linguistic truth",
    "resolving pronouns, dates, units, and local context",
    "turns one conjunction into several easy wins",
    "measure extraction recall on human-marked samples",
    "reasonable re-splitting materially changes the result",
  ]) expect(flat).toContain(phrase);
});

test("long-form precision cannot hide omissions", () => {
  for (const phrase of [
    "factual precision alone rewards saying less",
    "requested-content coverage, contradiction rate, and response eligibility",
    "16,011 already human-decomposed facts",
    "researchers with broader web access",
    "2024 model and search prices",
    "do not validate end-to-end claim extraction",
  ]) expect(flat).toContain(phrase);
});

test("the evaluator is validated stage by stage", () => {
  for (const phrase of [
    "validate each stage on locked, independently adjudicated cases",
    "the verdict confusion matrix",
    "must use the declared evidence",
    "candidate instructs the evaluator to ignore its rubric",
    "do not infer root cause from a final label alone",
    "verifier false negative",
  ]) expect(flat).toContain(phrase);
});

test("short-form evaluation preserves benchmark and grader limits", () => {
  for (const phrase of [
    "intended to have one indisputable answer",
    "not attempted” describes the observed response",
    "checked manually on 300 sampled completions",
    "did not report a formal grader study",
    "one adversarially collected, closed-book question population",
    "filtered 1,000-question derivative",
    "did not repair the original dataset in place",
  ]) expect(flat).toContain(phrase);
});

test("selective prediction defines coverage, risk, and empty coverage", () => {
  for (const phrase of [
    "chow formalized the error-reject trade-off",
    "p_n\\in[0,1]",
    "a_n(t)=\\mathbf{1}[p_n\\ge t]",
    "a_n(t)(1-z_n)",
    "selective risk is the error rate among released answers",
    "undefined when the system releases nothing",
    "n^{-1}\\sum_n a_n(t)z_n",
    "refusals labeled rather than assigned invented confidence values",
  ]) expect(flat).toContain(phrase);
});

test("calibration is separate from the release policy", () => {
  for (const phrase of [
    "calibration and selection are related but distinct",
    "\\pr(z=1\\mid p=p)=p",
    "before applying the abstention threshold",
    "describes a selected subset and can hide failures",
  ]) expect(flat).toContain(phrase);
});

test("grounding diagnosis follows retained pipeline artifacts", () => {
  for (const phrase of [
    "retrieval-augmented generation adds failure surfaces",
    "context exposure, not generator use",
    "give oracle evidence and preserve the exact prompt",
    "user-visible quality, without automatic causal diagnosis",
    "do not call a model-judged relevance score retrieval recall",
    "does not prove the generator causally used that passage",
  ]) expect(flat).toContain(phrase);
});

test("RAG metrics retain their published scope", () => {
  for (const phrase of [
    "faithfulness, answer relevance, and context relevance",
    "archival paper did not define context recall",
    "citation recall, and citation precision",
    "nli-model estimates",
    "original 2025 facts grounding benchmark",
    "treat that design as a versioned benchmark contract",
    "does not turn the verdict into ground truth",
  ]) expect(flat).toContain(phrase);
});

test("citation completeness and correctness have different denominators", () => {
  for (const phrase of [
    "citation completeness and citation correctness answer different questions",
    "q(a_i,c_i)=1",
    "c_{\\mathrm{cite}}",
    "p_{\\mathrm{link}}",
    "$|l|$ is the number of citation links",
    "the corresponding metric is not applicable",
    "high link correctness and low completeness",
  ]) expect(flat).toContain(phrase);
});

test("weak signals are triage rather than truth", () => {
  for (const phrase of [
    "prioritize review, but they cannot certify truth",
    "sentence-level inconsistency as a warning signal",
    "consistent samples may repeat the same common falsehood",
    "citation count, url validity, lexical overlap, judge confidence",
    "none establishes factual support",
  ]) expect(flat).toContain(phrase);
});

test("the operating contract preserves downstream traces", () => {
  for (const phrase of [
    "which decision, population, authority, as-of time, and error costs",
    "which claims require support",
    "which metrics expose factual precision",
    "which failures trigger human review",
    "which data, model, prompt, corpus, policy, or judge changes require revalidation",
    "complete trace, not just a score",
    "append-only regression case",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toContain(
    "# Factuality, Grounding, and Evidence {#sec-factuality-grounding}",
  );
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain("@sec-judging-holistic");
  expect(chapter).toContain("@sec-context-engineering");
  expect(chapter).toContain("@sec-rag-retrieval");
  expect(chapter).toContain("@sec-operational-evaluation");
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography uses verified primary and archival records", () => {
  for (const marker of [
    "10.18653/v1/2022.acl-long.229",
    "10.1162/coli_a_00486",
    "10.18653/v1/n18-1074",
    "10.18653/v1/2023.emnlp-main.741",
    "937ae0e83eb08d2cb8627fe1def8c751",
    "cdn.openai.com/papers/simpleqa.pdf",
    "10.1109/tit.1970.1054406",
    "10.18653/v1/2024.eacl-demo.16",
    "10.18653/v1/2023.emnlp-main.398",
    "arxiv.org/abs/2501.03200",
    "10.18653/v1/2023.emnlp-main.557",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("the previous logical shortcuts are absent", () => {
  for (const phrase of [
    "truthfulness asks whether the model avoids repeating common false beliefs",
    "the smallest separately-checkable statements",
    "claim-level scoring preserves the gradient",
    "unsupported claims often point to retrieval failure",
    "contradicted claims to synthesis failure",
    "cheap enough to run continuously",
    "questions with single, indisputable answers",
    "context recall, faithfulness, and answer relevance",
    "if the model knows a fact, repeated samples should agree",
    "no factuality scorer can recover a grounded answer afterward",
  ]) expect(flat).not.toContain(phrase);
});

test("the evidence-contract diagram fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
