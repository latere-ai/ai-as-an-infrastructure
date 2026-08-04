import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/reasoning/06-reasoning-data-distillation.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/reasoning-data-distillation.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter remains UTF-8 text and owns every literature citation", () => {
  expect(chapter).not.toContain("\0");
  expect(bibliography).not.toContain("\0");

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(10);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the opening separates trace construction, selection, training, and distillation", () => {
  for (const phrase of [
    "sampling creates a pool of candidates",
    "selection changes the distribution",
    "supervised fine-tuning imitates selected text",
    "distillation transfers a teacher's output distribution",
    "not an automatic consequence of using a smaller student",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).toContain("flowchart TD");
  expect(chapter).toContain("fig-reasoning-data-distillation-1");
  expect(chapter).toContain("Demonstration corpus");
  expect(chapter).toContain("Verifier, preference, or error-model training");
  expect(chapter).toContain("Model-size transfer");
  expect(chapter).toContain("Output-length compression");
  expect(chapter).not.toContain("/figures/reasoning-data-distillation-1.svg");
});

test("trace training covers every answer token and states weighting choices", () => {
  for (const expression of [
    "y_{i,1:U_i}",
    "\\sum_{u=1}^{U_i}",
    "\\alpha_z",
    "\\alpha_y",
    "Z_i=T_i+U_i",
    "1/K_i",
  ]) {
    expect(chapter).toContain(expression);
  }
  expect(flat).toContain("masks the prompt and predicts the trace and answer");
  expect(flat).toContain("neither choice is neutral");
});

test("the data contract gives metadata an operational role", () => {
  for (const field of [
    "split_group",
    "checker_versions",
    "prompt_template",
    "parent_hashes",
    "accepted_for_sft",
    "preference_role",
    "audit_only",
    "rejection_reason",
  ]) {
    expect(chapter).toContain(field);
  }
  expect(flat).toContain("failed trace from silently entering positive supervised data");
});

test("rejection sampling defines the accepted distribution and prompt bias", () => {
  expect(chapter).toContain("q_A(s\\mid x)");
  expect(chapter).toContain("q_\\phi(s\\mid x)a(x,s)");
  expect(chapter).toContain("1-(1-p_x)^K");
  expect(flat).toContain("the teacher and the admission rule therefore co-author the dataset");
  expect(flat).toContain("positive-only sft learns nothing from a rejected row");
});

test("STaR is represented as answer-conditioned rationalization with checkpoint reset", () => {
  for (const phrase of [
    "revealing the known answer as a hint",
    "remove the answer hint from the training input",
    "fine-tune a fresh copy of m_0",
    "post-hoc explanation conditioned on that answer",
    "filtered on answer correctness, not on a proof",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).not.toContain("checker_trace_or_answer");
});

test("RFT is scoped to its reported GSM8K recipe", () => {
  for (const phrase of [
    "100 solutions per gsm8k problem at temperature 0.7",
    "incorrect calculations using python",
    "ordered equation lists",
    "35.9% to 49.3%",
    "offline data construction",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("small-data evidence includes production cost and base-model conditions", () => {
  for (const phrase of [
    "only 53.6% of the s1k generations correct",
    "limo used 800 selected mathematical examples",
    "tens of millions of problems",
    "openthoughts ran more than 1,000 controlled pipeline experiments",
    "1.2-million-example corpus",
    "53.3% on aime 2025",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).not.toContain("817");
});

test("distillation distinguishes soft logits, hard sequences, size, and output length", () => {
  for (const expression of [
    "\\mathcal L_{\\mathrm{soft}}",
    "D_{\\mathrm{KL}}",
    "\\mathcal L_{\\mathrm{hard}}",
  ]) {
    expect(chapter).toContain(expression);
  }
  for (const phrase of [
    "requires comparable vocabularies and access to teacher logits",
    "student imitates the accepted distribution",
    "model-size compression changes parameter count",
    "output-length compression changes generated tokens",
    "does not establish short-output behavior",
    "sample eight responses and use the shortest correct one",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("weak supervision and operating guidance retain their conditions", () => {
  for (const phrase of [
    "weak teachers had themselves received rl",
    "recovered 94.34% of the direct-rl gain",
    "not a universal fraction of rl capability",
    "register prompt families before generation",
    "store every decision, not only winners",
    "compare against answer-only sft",
    "licenses and deletion lineage",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the rewrite removes the unsupported shortcuts", () => {
  for (const phrase of [
    "long traces teach deliberation",
    "a thousand hard, diverse, correct traces may teach",
    "the model is learning a style of search",
    "checker_trace_or_answer",
    "distillation changes the location of the cost",
  ]) {
    expect(flat).not.toContain(phrase);
  }
});
