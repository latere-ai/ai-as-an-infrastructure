import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const chapter = readFileSync(
  new URL("../../en/frontiers/03-verification-frontier.qmd", import.meta.url),
  "utf8",
);
const chineseChapter = readFileSync(
  new URL("../../zh/frontiers/03-verification-frontier.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/verification-frontier.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the thesis defines a verification frontier without claiming a measured law", () => {
  expect(chapter).toMatch(
    /^# The Verification Frontier: Proof, Oversight, and Trust After Capability \{#sec-verification-frontier\}/,
  );
  for (const phrase of [
    "gap between producing a claim and justifiably accepting it",
    "working hypothesis",
    "not a measured universal law",
    "narrower than the whole safety problem",
    "claim with evidence",
  ]) expect(flat).toContain(phrase);
  expect(chapter).not.toContain("/figures/verification-frontier-1.svg");
});

test("acceptance is a versioned evidence contract, not one verifier score", () => {
  for (const marker of [
    "A_j(c,e)",
    "p_j(c,e)",
    "h_{jk}(c,e)",
    "s_{j\\ell}(c,e)",
    "\\tau_{j\\ell}",
  ]) expect(chapter).toContain(marker);
  for (const phrase of [
    "claim class",
    "evidence bundle",
    "provenance predicate",
    "hard check",
    "diagnostic score",
    "acceptance authority",
    "versioned policy",
    "does not turn judgment into truth",
  ]) expect(flat).toContain(phrase);
});

test("verification capacity is modeled as a comparable-unit backlog", () => {
  expect(chapter).toContain("B_{t+1}");
  expect(chapter).toContain("\\max\\{0, B_t + G_t - R_t\\}");
  for (const phrase of [
    "same claim class",
    "same risk tier",
    "pending review",
    "new claims",
    "completed review decisions",
    "accounting identity",
    "not a queueing theorem",
  ]) expect(flat).toContain(phrase);
});

test("the review-capacity example is dependency-free and executable", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toMatch(/numpy|matplotlib|pandas/);
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain("fixed capacity backlog: 240");
  expect(run.stdout.toString()).toContain("scaled capacity backlog: 0");
});

test("checks state their guarantees and their boundaries", () => {
  for (const phrase of [
    "exact formal statement",
    "trusted computing base",
    "executed cases",
    "inside the simulator's model",
    "same data, code, and methods",
    "new data",
    "does not establish",
    "not independent evidence",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("a compiler proves that a program preserves semantics");
  expect(flat).not.toContain("surviving dispute");
});

test("formal proof remains scoped to the statement and checker", () => {
  for (const phrase of [
    "cminor to powerpc assembly",
    "semantic-preservation theorem",
    "hol light and isabelle",
    "formalization gap",
    "library gap",
    "kernel trust",
    "translation gap",
    "wrong formal statement",
  ]) expect(flat).toContain(phrase);
  for (const system of [
    "GPT-f",
    "MiniF2F",
    "FrontierMath",
    "LeanDojo",
    "DeepSeek-Prover-V2",
    "AlphaGeometry2",
  ]) expect(chapter).toContain(system);
  for (const phrase of [
    "12 june 2026",
    "42 percent",
    "338 remained",
    "prompt and reference answer",
  ]) expect(flat).toContain(phrase);
});

test("discovery separates evaluator scores from acceptance", () => {
  for (const phrase of [
    "human supplies evaluation code",
    "defines what improvement means",
    "manual experimentation",
    "outside the reported system's scope",
    "held-out tests",
    "expert checks",
    "post-deployment measurement",
    "search evidence",
    "not an acceptance decision",
  ]) expect(flat).toContain(phrase);
});

test("learned oversight evidence retains its experimental scope", () => {
  for (const phrase of [
    "five synthetic combinatorial tasks",
    "mnist",
    "800,000",
    "best-of-n selection",
    "not train the generator",
    "verification rationales",
    "not certificates",
    "nlp, chess, and reward modeling",
    "5,000 apps programming tasks",
    "not a deployment guarantee",
  ]) expect(flat).toContain(phrase);
});

test("the ELK theorem is reported with its assumptions", () => {
  for (const phrase of [
    "causal influence diagram",
    "strict subset",
    "off-distribution",
    "perfect on the training distribution",
    "with certainty",
    "specified class",
    "does not prove that every practical oversight method fails",
  ]) expect(flat).toContain(phrase);
});

test("independence, provenance, and the acceptance ledger are operational", () => {
  for (const phrase of [
    "claim id",
    "evidence-contract version",
    "generator and resource budget",
    "evidence hash",
    "checker versions",
    "independence",
    "acceptance authority",
    "decision and date",
    "expiry condition",
    "reproduction status",
    "correlated agreement",
  ]) expect(flat).toContain(phrase);
});

test("stable cross-layer handoffs and interactive figure remain", () => {
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Constraint arrow|## Lower-layer constraint/i);
  expect(chapter).toContain("::: {#further-reading}");
  expect(chapter).toContain('data-viz="verification-frontier"');
  for (const ref of [
    "@sec-verifiable-rewards",
    "@sec-verifiers-process-supervision",
    "@sec-evaluating-agents",
    "@sec-oversight-control",
  ]) expect(chapter).toContain(ref);
  for (const phrase of [
    "Part XI asks how these constraints",
    "Part XII asks how to operate systems",
    "operating contracts",
  ]) expect(chapter).toContain(phrase);
});

test("hard wraps do not split hyphenated compounds in rendered prose", () => {
  expect(chapter).not.toMatch(/[A-Za-z]-\n[A-Za-z]/);
});

test("the bibliography uses verified primary-source metadata", () => {
  for (const marker of [
    "10.1007/s10817-009-9155-4",
    "10.1017/fmp.2017.1",
    "proceedings.neurips.cc/paper_files/paper/2023",
    "proceedings.mlr.press/v235/burns24b.html",
    "proceedings.mlr.press/v235/greenblatt24a.html",
    "10.17226/25303",
  ]) expect(bibliography.toLowerCase()).toContain(marker);

  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(17);
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

test("the complete chapter renders without swallowing diagrams or late prose", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "frontiers/verification-frontier.html",
    chapterTitle: "The Verification Frontier: Proof, Oversight, and Trust After Capability",
    chapterNum: "72",
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
  expect(html).toContain("The frontier is an evidence-engineering problem");
  expect(html.match(/<figure class="rdr-figure"/g)?.length).toBe(4);
  expect(headings.some(({ text }) => text === "Further reading")).toBeTrue();
});

test("every Graphviz figure parses and fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(4);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
