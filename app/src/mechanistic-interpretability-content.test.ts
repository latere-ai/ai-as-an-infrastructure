import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/safety/01-mechanistic-interpretability.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/mechanistic-interpretability.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening defines a scoped explanatory claim", () => {
  for (const phrase of [
    "how a fixed model produced a specified behavior",
    "model revision",
    "input population",
    "behavior or output",
    "internal site",
    "not a transcript of hidden thoughts",
    "not by itself a safety guarantee",
  ]) expect(flat).toContain(phrase);
});

test("the chapter separates evidence levels instead of treating labels as mechanisms", () => {
  for (const phrase of [
    "description, prediction, intervention, and mediation",
    "a coherent label is not a causal explanation",
    "held-out inputs",
    "necessity or sufficiency under the stated intervention",
    "natural computation",
    "strongest claim supported by the weakest link",
  ]) expect(flat).toContain(phrase);
});

test("superposition is presented as a hypothesis with a self-contained model", () => {
  for (const phrase of [
    "the hypothesis is @gls-superposition: a model represents more features than it has dimensions",
    "toy models demonstrate that this packing is possible",
    "do not prove that every transformer activation",
    "activation vector",
    "feature coefficient",
    "feature direction",
    "unexplained residual",
    "sparsity assumption",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/x\s*=\s*\\sum_\{i=1\}\^m a_i v_i\s*\+\s*\\varepsilon/);
  expect(flat).not.toContain("superposition is a fact about the architecture");
  expect(flat).not.toContain("no method that reads neurons directly can work");
});

test("the sparse-autoencoder formulation defines its tensors and objective", () => {
  for (const phrase of [
    "w_{\\mathrm{enc}} \\in \\mathbb{r}^{m \\times d}",
    "w_{\\mathrm{dec}} \\in \\mathbb{r}^{d \\times m}",
    "encoder bias",
    "decoder bias",
    "at most k nonzero entries",
    "unit-norm decoder columns",
    "scale degeneracy",
    "mean squared reconstruction error",
  ]) expect(flat).toContain(phrase);
  expect(chapter).toMatch(/f\s*&=\s*\\operatorname\{TopK\}_k/);
  expect(chapter).toMatch(/\\hat\{x\}\s*&=\s*W_\{\\mathrm\{dec\}\}f\+b_\{\\mathrm\{dec\}\}/);
});

test("display equations use mobile-safe aligned rows", () => {
  expect(chapter).toMatch(/z\s*&=.*?\\\\\nf\s*&=.*?\\\\\n\\hat\{x\}\s*&=/s);
  expect(chapter).toMatch(/\\mathcal\{L\}_\{\\mathrm\{TopK\}\}[\s\S]*?\\\\\n\\lVert W_\{\\mathrm\{dec\}\}/);
  expect(chapter).toMatch(/\\Delta_j\(x_b,x_s\)\s*&=\s*\\\\\n&.*?\\\\\n&-s/s);
});

test("SAE quality is evaluated on several independent axes", () => {
  for (const phrase of [
    "reconstruction fidelity",
    "downstream fidelity",
    "activation sparsity",
    "dead latents",
    "stability across seeds",
    "held-out feature labels",
    "causal utility",
    "no single metric certifies a dictionary",
  ]) expect(flat).toContain(phrase);
});

test("causal localization declares the counterfactual design", () => {
  for (const phrase of [
    "clean and corrupted runs",
    "patch one internal component",
    "corruption procedure",
    "output metric",
    "patch location",
    "causal relevance to that contrast",
    "does not identify a unique mechanism",
  ]) expect(flat).toContain(phrase);
});

test("features are recomposed into qualified circuit hypotheses", () => {
  for (const phrase of [
    "causal subgraph relative to a behavior and input distribution",
    "induction heads",
    "evidence for an induction mechanism",
    "not proof that induction heads explain all in-context learning",
    "replacement model",
    "fixed attention patterns",
    "local hypothesis about one computation",
    "not a complete trace of the original model",
  ]) expect(flat).toContain(phrase);
});

test("known failure modes bound the interpretation", () => {
  for (const phrase of [
    "reconstruction error",
    "feature splitting",
    "feature absorption",
    "probing baseline",
    "dictionary is not unique",
    "off the model's ordinary activation distribution",
    "automatic feature labels",
    "local explanation",
  ]) expect(flat).toContain(phrase);
});

test("the operating contract makes every study reproducible", () => {
  for (const field of [
    "study_id",
    "model_and_tokenizer_hashes",
    "behavior_and_output_metric",
    "input_population_and_splits",
    "activation_sites",
    "method_and_code_revision",
    "dictionary_width_and_sparsity",
    "training_data_and_seeds",
    "baselines_and_validity_metrics",
    "intervention_protocol",
    "retained_artifacts",
    "claim_scope_and_known_failures",
  ]) expect(flat).toContain(field);
  expect(flat).toContain("cannot authorize a safety decision on its own");
});

test("stable chapter structure and handoffs remain", () => {
  expect(chapter).toContain("# Mechanistic Interpretability {#sec-interpretability}");
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain("@sec-transformer-architecture");
  expect(chapter).toContain("@sec-oversight-control");
  expect(chapter).toContain('data-viz="superposition"');
  expect(chapter).toContain("::: {#further-reading}");
});

test("the bibliography uses primary and accessible records", () => {
  for (const marker of [
    "distill.pub/2020/circuits/zoom-in",
    "transformer-circuits.pub/2021/framework",
    "arxiv.org/abs/2209.10652",
    "proceedings.iclr.cc/paper_files/paper/2024",
    "42ef3308c230942d223c411adf182c88",
    "arxiv.org/abs/2309.16042",
    "transformer-circuits.pub/2025/attribution-graphs/methods",
    "proceedings.neurips.cc/paper_files/paper/2025",
    "arxiv.org/abs/2511.13653",
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

test("the misleading demo and machine-like framing are absent", () => {
  expect(chapter).not.toContain(":::: {.runnable}");
  for (const phrase of [
    "language models do not cooperate",
    "the wall that stops naive interpretation",
    "features alone are nouns",
    "an arms race against the wall",
    "the trial of the sparse autoencoder",
    "a feature you cannot steer with is a feature you have not understood",
    "the wall, in the end, is never fully climbed",
    "the latest step",
  ]) expect(flat).not.toContain(phrase);
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
