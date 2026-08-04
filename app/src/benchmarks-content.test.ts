import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/evaluation/01-benchmarks.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/benchmarks.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("a benchmark score is scoped to a measurement contract", () => {
  for (const phrase of [
    "not a property of model weights alone",
    "one model revision through one harness",
    "population, a system boundary, a comparison, and guardrails",
    "no single public benchmark can settle the decision",
  ]) expect(flat).toContain(phrase);
});

test("benchmark forms are tied to observable evidence and limits", () => {
  for (const phrase of [
    "closed-answer questions",
    "executable tasks",
    "synthetic probes",
    "human preference comparisons",
    "interactive environments",
    "adding unrelated tests can make a dashboard larger",
  ]) expect(flat).toContain(phrase);
});

test("the evaluation artifacts preserve data, system, and scorer versions", () => {
  for (const field of [
    "benchmark_revision",
    "item_manifest_hash",
    "model_revision",
    "tokenizer_revision",
    "prompt_template_revision",
    "tool_environment_revision",
    "scorer_revision",
    "contamination_audit_revision",
    "raw_output_hash",
    "scorer_trace",
  ]) expect(flat).toContain(field);
});

test("the estimator defines weighting, pairing, and clustered repetitions", () => {
  for (const phrase of [
    "\\widehat{\\mu}",
    "predeclared weight",
    "equal weights do not mean",
    "d_i = y_i^{(b)} - y_i^{(a)}",
    "twenty attempts on one repository are not twenty independent repositories",
  ]) expect(flat).toContain(phrase);
});

test("held-out status covers the full adaptive development pipeline", () => {
  for (const phrase of [
    "pipeline contract, not a property a file can prove",
    "exposure unknown",
    "training leakage",
    "indirect leakage",
    "development leakage",
    "reporting leakage",
    "ordinary adaptive overfitting",
  ]) expect(flat).toContain(phrase);
});

test("contamination audits are evidence rather than certificates", () => {
  for (const phrase of [
    "audits provide evidence about exposure, not proof of absence",
    "exact hashes and n-gram matching",
    "canaries reveal ingestion",
    "membership signal",
    "negative result does not certify",
    "no_overlap_found_under_audit_x",
    "not_auditable",
  ]) expect(flat).toContain(phrase);
});

test("publication designs present explicit tradeoffs", () => {
  for (const phrase of [
    "public, static set",
    "private, static set",
    "rotating or newly sourced set",
    "generated or live environment",
    "answer different questions",
  ]) expect(flat).toContain(phrase);
});

test("item and scorer audits preserve failure semantics", () => {
  for (const phrase of [
    "incorrect keys",
    "alternative valid forms",
    "adjudication log",
    "invalid`, `unknown`, `timeout`, and `scorer_error",
    "does not mean “interpretation-free",
  ]) expect(flat).toContain(phrase);
});

test("controlled-model and best-system experiments are distinguished", () => {
  for (const phrase of [
    "controlled model comparison",
    "best-system comparison",
    "do not label the second as a comparison of weights",
    "state which experiment is being run",
  ]) expect(flat).toContain(phrase);
});

test("benchmark decay is not reduced to saturation", () => {
  for (const phrase of [
    "adaptive reuse",
    "population drift",
    "scorer drift",
    "difficulty is useful only if",
    "preserve a stable anchor set",
  ]) expect(flat).toContain(phrase);
});

test("the operating procedure is reproducible and auditable", () => {
  for (const phrase of [
    "freeze the model, harness, scorer, item manifest",
    "store raw outputs, parsed outputs, scorer traces",
    "aggregate at the correct sampling unit",
    "no item disappears silently",
    "every reported number resolves to a spec hash",
  ]) expect(flat).toContain(phrase);
});

test("unsupported leaderboard and trust claims were removed", () => {
  for (const phrase of [
    "frontier models clustered above 90%",
    "a public benchmark should be assumed contaminated",
    "a private held-out set is trustworthy",
    "dynamic evaluation resists gaming",
    "the only reliable way",
    "vals2026gpqa",
    "futurehouse2025hle",
    "liang2025swebenchillusion",
    "rng = np.random.default_rng",
  ]) expect(flat).not.toContain(phrase);
});

test("the bibliography uses verified archival records", () => {
  for (const marker of [
    "datasets-benchmarks-proceedings.neurips.cc/paper/2021",
    "doi.org/10.1145/3458723",
    "pubmed.ncbi.nlm.nih.gov/26250683",
    "aclanthology.org/2024.acl-long.861",
    "aclanthology.org/2025.naacl-long.262",
    "proceedings.iclr.cc/paper_files/paper/2024/hash/edac78c3",
    "proceedings.iclr.cc/paper_files/paper/2024/hash/e32ad85f",
    "proceedings.iclr.cc/paper_files/paper/2025/hash/e4a46394",
    "openreview.net/forum?id=io4lzibeqw",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("uncited legacy sources stay out of further reading", () => {
  for (const key of [
    "cobbe2021verifiers",
    "hendrycks2021math",
    "rein2023gpqa",
    "phan2025hle",
    "chollet2025arcagi2",
    "arcprize2026arcagi3",
    "liang2025swebenchillusion",
    "yue2023mmmu",
    "hsieh2024ruler",
    "mialon2023gaia",
    "yao2024taubench",
    "zhou2023webarena",
    "chiang2024chatbot",
    "xie2024osworld",
    "wei2025browsecomp",
  ]) {
    const start = bibliography.indexOf(`{${key},`);
    expect(start).toBeGreaterThanOrEqual(0);
    const end = bibliography.indexOf("\n@", start);
    const entry = bibliography.slice(start, end < 0 ? undefined : end);
    expect(entry).toContain("further");
    expect(entry).toContain("{no}");
  }
});

test("stable structure and the reliability handoff remain", () => {
  expect(chapter).toContain("# Benchmarks as Measurement Contracts {#sec-benchmarks}");
  expect(chapter).toMatch(/## .*contested/i);
  expect(chapter).toMatch(/## .*lower-layer constraint/i);
  expect(chapter).toContain("@sec-statistical-reliability");
  expect(chapter).toContain("::: {#further-reading}");
});

test("the measurement-contract diagram fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
