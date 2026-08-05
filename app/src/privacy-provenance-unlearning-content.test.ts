import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/safety/06-privacy-provenance-unlearning.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/privacy-provenance-unlearning.bib", import.meta.url),
  "utf8",
);
const bibliographyCorpus = readdirSync(new URL("../../refs/", import.meta.url))
  .filter((name) => name.endsWith(".bib"))
  .map((name) => readFileSync(new URL(`../../refs/${name}`, import.meta.url), "utf8"))
  .join("\n");
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening separates privacy, unlearning, and provenance", () => {
  for (const phrase of [
    "privacy, unlearning, and provenance answer three different questions",
    "training-data privacy asks",
    "machine unlearning asks",
    "provenance asks",
    "none of these promises follows from the others",
    "a model can protect training records without attaching provenance",
    "a signed output can still disclose private information",
  ]) expect(flat).toContain(phrase);
});

test("memorization, extractability, disclosure, and membership are distinct", () => {
  for (const phrase of [
    "memorization",
    "extractability",
    "disclosure",
    "membership inference",
    "different events",
    "a memorized sequence is not necessarily extractable",
    "an extracted sequence is not necessarily personal data",
    "dataset membership can itself be sensitive",
  ]) expect(flat).toContain(phrase);
});

test("the privacy threat model names the unit, adjacency, access, and harm", () => {
  for (const phrase of [
    "privacy unit",
    "record-level",
    "user-level",
    "adjacent datasets",
    "attacker access",
    "auxiliary information",
    "query budget",
    "success criterion",
    "affected person",
  ]) expect(flat).toContain(phrase);
});

test("data minimization and deduplication have bounded claims", () => {
  for (const phrase of [
    "data minimization",
    "purpose limitation",
    "deduplication reduced measured memorization",
    "does not provide differential privacy",
    "pii detection has false positives and false negatives",
    "derived datasets",
    "tokenized copies",
    "fine-tuning data",
  ]) expect(flat).toContain(phrase);
});

test("differential privacy is formally defined with every symbol explained", () => {
  for (const phrase of [
    "randomized training mechanism",
    "adjacent datasets $d$ and $d'$",
    "measurable set of possible outputs",
    "privacy-loss bound",
    "smaller $\\varepsilon$",
    "$\\delta$",
    "privacy unit determines what adjacency means",
    "composition",
    "privacy accountant",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/\\Pr\[\\mathcal\{M\}\(D\)\\in S\]/);
  expect(chapter).toMatch(/e\^\{\\varepsilon\}/);
});

test("DP-SGD defines clipping, noise, sampling, and optimization", () => {
  for (const phrase of [
    "per-example gradient",
    "clipping norm",
    "noise multiplier",
    "gaussian noise",
    "batch size",
    "learning rate",
    "sampling rate",
    "number of steps",
    "utility must be measured",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/\\widetilde\{g\}_t/);
  expect(chapter).toMatch(/\\theta_\{t\+1\}/);
});

test("serving controls mitigate exposure without claiming erasure", () => {
  for (const phrase of [
    "serving-time controls",
    "rate limits",
    "output filtering",
    "access control",
    "monitoring",
    "reduce exposure",
    "do not remove training influence",
    "already disclosed",
  ]) expect(flat).toContain(phrase);
});

test("machine unlearning is defined against a retraining reference", () => {
  for (const phrase of [
    "@gls-machine-unlearning, a process that aims to remove the influence of specified training data from a trained model",
    "training algorithm",
    "forget set",
    "retained dataset",
    "unlearning algorithm",
    "retraining reference",
    "exact unlearning",
    "approximate unlearning",
    "distribution of artifacts",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/\\mathcal\{U\}/);
  expect(chapter).toMatch(/\\mathcal\{A\}/);
  expect(chapter).toMatch(/D\\setminus D_f/);
});

test("SISA is scoped to its architecture and assumptions", () => {
  for (const phrase of [
    "sisa",
    "shards",
    "slices",
    "retrain only affected components",
    "training procedure must be designed in advance",
    "aggregation",
    "randomness",
    "does not make arbitrary post-hoc editing exact",
  ]) expect(flat).toContain(phrase);
});

test("unlearning evaluation covers forgetting, retention, and recovery", () => {
  for (const phrase of [
    "forget-set behavior",
    "retain-set utility",
    "retraining reference",
    "membership inference",
    "extraction attempts",
    "paraphrases",
    "relearning",
    "collateral damage",
    "one refusal is not evidence of unlearning",
  ]) expect(flat).toContain(phrase);
});

test("deletion follows every affected artifact rather than only the base weights", () => {
  for (const phrase of [
    "source record",
    "dataset snapshots",
    "deduplicated copies",
    "checkpoints",
    "optimizer state",
    "adapters",
    "embeddings",
    "retrieval indexes",
    "caches",
    "future training runs",
    "deletion tombstone",
  ]) expect(flat).toContain(phrase);
});

test("knowledge editing is not presented as deletion", () => {
  for (const phrase of [
    "knowledge editing is not machine unlearning",
    "changes selected model behavior",
    "does not establish that a training record's influence is gone",
    "paraphrase",
    "logical consequence",
    "collateral changes",
  ]) expect(flat).toContain(phrase);
});

test("watermark evidence includes thresholds and failure rates", () => {
  for (const phrase of [
    "statistical watermark",
    "detector threshold",
    "false-positive rate",
    "false-negative rate",
    "text length",
    "sampling configuration",
    "quality",
    "paraphrase",
    "translation",
    "absence of a detectable watermark is not proof of human authorship",
  ]) expect(flat).toContain(phrase);
});

test("C2PA authenticates a manifest without certifying truth", () => {
  for (const phrase of [
    "c2pa",
    "signed manifest",
    "asset hash",
    "signing credential",
    "edit history",
    "tamper evidence",
    "does not prove that the depicted event happened",
    "unknown signer",
    "stripped manifest",
    "unsigned asset is not evidence that the asset is synthetic",
  ]) expect(flat).toContain(phrase);
});

test("the operating record connects privacy, deletion, and provenance evidence", () => {
  for (const field of [
    "data_subject_or_record_scope",
    "source_and_legal_basis",
    "dataset_and_transform_revisions",
    "privacy_unit_and_adjacency",
    "dp_mechanism_and_accountant",
    "training_job_and_artifact_revisions",
    "deletion_request_and_tombstone",
    "affected_artifact_inventory",
    "unlearning_method_and_retraining_reference",
    "forget_retain_and_privacy_results",
    "provenance_mechanism_and_signer",
    "detector_threshold_and_error_rates",
    "verification_and_exception_owner",
  ]) expect(flat).toContain(field);
});

test("regression scenarios cover privacy, deletion lineage, and provenance", () => {
  for (const phrase of [
    "duplicated canary",
    "one user across many records",
    "pii detector miss",
    "membership distribution shift",
    "checkpoint and adapter copy",
    "forget-set paraphrase",
    "relearning attack",
    "retained-utility regression",
    "watermark paraphrase",
    "human-text false positive",
    "stripped c2pa manifest",
    "tampered asset",
  ]) expect(flat).toContain(phrase);
});

test("stable structure and cross-layer handoffs remain", () => {
  expect(chapter).toContain("# Privacy, Provenance, and Unlearning {#sec-privacy-provenance}");
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain('data-viz="stepper"');
  for (const ref of [
    "@sec-data-curation",
    "@sec-runtime-safety",
    "@sec-confidential-inference",
    "@sec-law-policy",
    "@sec-interpretability",
  ]) expect(chapter).toContain(ref);
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography includes primary privacy, unlearning, and provenance sources", () => {
  for (const marker of [
    "arxiv.org/abs/2012.07805",
    "aclanthology.org/2022.acl-long.577",
    "doi.org/10.1561/0400000042",
    "proceedings.mlr.press/v119/guo20c.html",
    "arxiv.org/abs/2401.06121",
    "nature.com/articles/s41586-024-08025-4",
    "c2pa.org/specifications",
  ]) expect(bibliographyCorpus.toLowerCase()).toContain(marker);
});

test("every literature citation resolves to a local bibliography entry", () => {
  const keys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  for (const key of keys) {
    expect(bibliographyCorpus).toMatch(new RegExp(`@[^{]+\\{${key},`, "i"));
  }
});

test("categorical and machine-like legacy claims are absent", () => {
  expect(chapter).not.toContain("/figures/privacy-provenance-unlearning-1.svg");
  for (const phrase of [
    "a model is a lossy compression of its training set",
    "the only sound place to fix the leak",
    "memorization is not a bug layered on top of learning",
    "the leak is real and not hypothetical",
    "membership inference is the cheapest privacy attack",
    "the hardest to fully close",
    "the single most effective memorization control",
    "privacy here is a free rider",
    "the guarantee is real and quantified",
    "the only training-time control that provably bounds memorization",
    "no flagship general model",
    "the baseline is brutal",
    "the one approach that retains an exact guarantee",
    "the only controls that bound the exposure",
    "a model trained to forget",
    "the uncomfortable thesis",
    "largely fail",
  ]) expect(flat).not.toContain(phrase);
});

test("hard wraps do not split hyphenated compounds in rendered prose", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("math uses delimiters supported by the book renderer", () => {
  for (const delimiter of ["\\(", "\\)", "\\[", "\\]"]) {
    expect(chapter).not.toContain(delimiter);
  }
});

test("the complete chapter renders without swallowing prose into display math", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "safety/privacy-provenance-unlearning.html",
    chapterTitle: "Privacy, Provenance, and Unlearning",
    chapterNum: "59",
    prefix: "../",
    graphviz,
    lang: "en",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings } = renderMarkdown(chapter, ctx);
  expect(html).not.toContain("katex-error");
  expect(html).toContain("Knowledge editing is not machine unlearning");
  expect(headings.some(({ text }) => text === "Provenance provides evidence, not truth")).toBeTrue();
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
