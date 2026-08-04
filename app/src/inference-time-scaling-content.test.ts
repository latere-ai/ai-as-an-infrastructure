import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/reasoning/07-inference-time-scaling.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/inference-time-scaling.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter remains plain UTF-8 text with local citation ownership", () => {
  expect(chapter).not.toContain("\0");
  expect(bibliography).not.toContain("\0");

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

test("the opening defines a controller and the resources it allocates", () => {
  for (const phrase of [
    "breadth",
    "depth",
    "evaluation",
    "external work",
    "serving resources",
    "parallel and sequential work describe dependencies",
    "proposal method, evaluation rule, controller, and budget",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).toContain("flowchart TD");
  expect(chapter).toContain("fig-inference-time-controller");
  expect(chapter).toContain("\\arg\\max_{a\\in\\mathcal A}");
  expect(chapter).toContain("\\mathbb E[U_x(Y_a)]");
  expect(chapter).not.toContain("/figures/inference-time-scaling-1.svg");
});

test("coverage is scoped to a proposal and its independence assumptions", () => {
  for (const expression of [
    "p_x",
    "C_k(x)=1-(1-p_x)^k",
    "Y\\sim\\pi(\\cdot\\mid x)",
  ]) {
    expect(chapter).toContain(expression);
  }
  for (const phrase of [
    "conditionally independent",
    "independent draws can still repeat",
    "diversity is a separate issue",
    "does not imply that every task has a comparable scaling curve",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("realized accuracy states the selector bound and its exact conditions", () => {
  expect(chapter).toContain("A_k(x)");
  expect(chapter).toContain("A_k(x)\\le C_k(x)");
  expect(flat).toContain("returns a correct candidate whenever one is present");
  expect(flat).toContain("output can leave the original set");
  for (const selector of ["exact checker", "answer voting", "learned scorer or judge"]) {
    expect(flat).toContain(selector);
  }
  expect(flat).toContain("a passing program can still be wrong outside the tests");
  expect(flat).toContain("verification also consumes compute");
});

test("the runnable demonstrates selector failure without presenting empirical data", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).toContain("selector_bias");
  expect(flat).toContain("constructed failure model, not an empirical fit");

  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const nonInteractiveCell = cell![1]
    .split("\n")
    .filter((line) => !line.startsWith("import matplotlib") && !line.startsWith("plt."))
    .join("\n");
  const run = Bun.spawnSync([python!, "-c", nonInteractiveCell], {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, MPLBACKEND: "Agg" },
  });
  expect(run.exitCode).toBe(0);
  expect(run.stdout.toString()).toMatch(/best selector k: \d+/);
});

test("sequential scaling identifies the source and limits of feedback", () => {
  for (const expression of ["Y_0\\sim\\pi", "F_t=\\phi", "Y_{t+1}\\sim R"]) {
    expect(chapter).toContain(expression);
  }
  for (const phrase of [
    "model's own critique",
    "executable check",
    "tool result",
    "retrieved material",
    "human feedback",
    "should not be described as equivalent",
    "without external feedback",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("budget evidence retains its benchmark and estimation conditions", () => {
  for (const phrase of [
    "aime 2024 contains only 30 questions",
    "2,048 samples per problem",
    "cost of estimating difficulty was excluded",
    "inference and pretraining demand",
    "does not prove that the true success probability is zero",
    "forced budgets from 500 to 16,000 tokens",
    "validated stopping policy",
  ]) {
    expect(flat).toContain(phrase);
  }
  expect(chapter).toContain('data-viz="ttc-budget"');
  expect(flat).toContain("values are not measurements or a universal scaling law");
});

test("cost includes retries and latency follows the critical path", () => {
  for (const expression of [
    "\\sum_{r=1}^{R}",
    "C_{\\mathrm{gen},r}+C_{\\mathrm{eval},r}+C_{\\mathrm{tools},r}",
    "C_{\\mathrm{controller}}",
    "\\max_{p\\in\\mathcal P}\\sum_{s\\in p}L_s",
  ]) {
    expect(chapter).toContain(expression);
  }
  expect(flat).toContain("attempt $r$ may be an initial call or retry");
  expect(flat).toContain("parallel samples can overlap in wall-clock time only when spare concurrency exists");
  expect(chapter).not.toContain("C_{\\mathrm{retry}}");
});

test("the operating guidance makes routing measurable and bounded", () => {
  for (const phrase of [
    "define utility before routing",
    "measure complete curves",
    "compare matched strategies",
    "audit selectors under search",
    "use explicit stop reasons",
    "meter every component",
    "protect the budget boundary",
    "output-only monitoring would miss that failure",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("the rewrite removes unsupported inference-scaling shortcuts", () => {
  for (const phrase of [
    "one knob left",
    "two spends are fungible",
    "selection is free",
    "zero coverage: no spend helps",
    "only a stronger model or better training helps",
    "verifier > reward model > majority vote",
    "less data, more inference",
    "by mid-2026 anthropic",
  ]) {
    expect(flat).not.toContain(phrase);
  }
});
