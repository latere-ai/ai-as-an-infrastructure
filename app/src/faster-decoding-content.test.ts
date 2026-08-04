import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/inference/03-faster-decoding.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/faster-decoding.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the decoding chapter remains plain UTF-8 with locally owned citations", () => {
  expect(chapter).not.toContain("\0");
  expect(bibliography).not.toContain("\0");
  const citeKeys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(citeKeys.size).toBeGreaterThanOrEqual(9);
  for (const key of citeKeys) {
    expect(bibliography, `${key} should be owned by the chapter bibliography`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("yield is derived from prefix survival rather than an aggregate acceptance rate", () => {
  for (const expression of [
    "s_k=\\Pr(A_1\\cap\\cdots\\cap A_k)",
    "\\mathbb E[Y]=1+\\sum_{k=1}^{\\gamma}s_k",
    "\\sum_{k=0}^{\\gamma}\\alpha^k",
    "\\frac{1-\\alpha^{\\gamma+1}}{1-\\alpha}",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "constant conditional acceptance probability",
    "tokens per verification cycle, not a latency speedup",
    "an aggregate accepted-token rate does not determine prefix survival",
  ]) expect(flat).toContain(phrase);
});

test("the runnable computes heterogeneous prefix survival deterministically", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toContain("numpy");
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString().trim().split("\n")).toEqual([
    "survival by position: 0.8500, 0.6375, 0.3825, 0.1530",
    "expected tokens/cycle: 3.0230",
    "iid estimate at alpha=0.65: 2.5256",
  ]);
});

test("modified rejection sampling defines and proves its distribution contract", () => {
  for (const expression of [
    "a(v)=\\min\\!\\left(1,\\frac{p(v)}{q(v)}\\right)",
    "Z=\\sum_{u\\in\\mathcal V}[p(u)-q(u)]_+",
    "r(v)=\\frac{[p(v)-q(v)]_+}{Z}",
    "q(v)a(v)+Zr(v)=\\min(p(v),q(v))+[p(v)-q(v)]_+=p(v)",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "the rejection probability is zero",
    "equal output distributions, not identical sampled token sequences",
    "temperature, truncation, constraints, and token mapping",
    "greedy verification is a separate deterministic contract",
  ]) expect(flat).toContain(phrase);
});

test("proposal source, topology, and acceptance policy remain independent", () => {
  for (const phrase of [
    "three independent choices",
    "separate autoregressive model",
    "attached draft heads",
    "feature or token drafter",
    "prompt lookup",
    "lookahead decoding",
    "multi-token prediction module",
    "a tree attention mask packs branches",
    "does not make a verifier exact",
  ]) expect(flat).toContain(phrase);
});

test("the candidate-tree diagram uses production Mermaid directives", () => {
  expect(chapter).toContain("%%| label: fig-faster-decoding-tree");
  expect(chapter).toContain("flowchart TD");
  expect(chapter).not.toContain("//| label: fig-faster-decoding-tree");
});

test("speedup accounts for measured cycle time and serving regime", () => {
  for (const expression of [
    "S_{\\mathrm{latency}}",
    "t_{\\mathrm{propose}}",
    "t_{\\mathrm{verify}}",
    "t_{\\mathrm{reconcile}}",
    "\\frac{t_{\\mathrm{cycle}}}{\\mathbb E[Y]}<t_1",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "verification time grows with candidate positions",
    "matched admitted load",
    "accepted-prefix length distribution",
    "temporary kv and workspace high-water marks",
    "no single acceptance rate or paper speedup answers",
  ]) expect(flat).toContain(phrase);
});

test("scheduler planning commits only verified target state", () => {
  for (const phrase of [
    "reserve candidate positions and workspace",
    "commit target kv only for the accepted draft prefix",
    "release every rejected tail or branch",
    "roll reservations back on cancellation or failure",
    "draft and target caches are separate namespaces",
    "corrected or bonus token becomes input to the next target cycle",
  ]) expect(flat).toContain(phrase);
});

test("verification covers distribution, state, load, and fallback failures", () => {
  for (const phrase of [
    "disjoint support",
    "eos, stop sequences, and maximum length",
    "mixed accepted-prefix lengths",
    "cache-block boundary",
    "tokenizer, adapter, or constraint mismatch",
    "disable speculation when its predicted cost exceeds baseline decoding",
  ]) expect(flat).toContain(phrase);
});

test("bibliography uses archival records and excludes mutable sources from further reading", () => {
  for (const url of [
    "https://proceedings.mlr.press/v202/leviathan23a.html",
    "https://proceedings.mlr.press/v235/cai24b.html",
    "https://aclanthology.org/2024.emnlp-main.422/",
    "https://proceedings.neurips.cc/paper_files/paper/2025/hash/c7b5a35ea98b62512a869c19ea7b03cb-Abstract-Conference.html",
    "https://proceedings.mlr.press/v235/fu24a.html",
    "https://proceedings.mlr.press/v235/gloeckle24a.html",
  ]) expect(bibliography).toContain(url);
  for (const key of ["ankner2024hydra", "deepseek2024deepseekv3", "sglang2025mtp", "saxena2023prompt"]) {
    const start = bibliography.indexOf(`{${key},`);
    const end = bibliography.indexOf("\n@", start);
    expect(bibliography.slice(start, end < 0 ? undefined : end)).toContain("further");
    expect(bibliography.slice(start, end < 0 ? undefined : end)).toContain("{no}");
  }
});

test("the rewrite removes unsupported shortcuts and synthetic figures", () => {
  for (const phrase of [
    "spare compute is nearly free",
    "verify candidates for free",
    "self-draft heads and feature-level drafting won out",
    "production default",
    "the lineage",
    "ships as a standard speculative method",
    "/figures/faster-decoding-1.svg",
    "/figures/faster-decoding-2.svg",
  ]) expect(flat).not.toContain(phrase);
});
