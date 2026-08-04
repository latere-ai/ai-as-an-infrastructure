import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/orchestration/01-training-agents-to-act.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/training-agents-to-act.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the chapter owns a primary-source literature trail", () => {
  const keys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(keys.size).toBeGreaterThanOrEqual(8);
  for (const key of keys) {
    expect(bibliography, `${key} should be owned by this chapter`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
  expect(bibliography).toContain("Proceedings of the 42nd International Conference on Machine Learning");
  expect(bibliography).toContain("Advances in Neural Information Processing Systems 38");
  expect(bibliography).toContain("Proceedings of the Twentieth European Conference on Computer Systems");
});

test("a trajectory is a self-contained partially observed interaction", () => {
  expect(chapter).toMatch(/\\tau\s*&?=/);
  expect(chapter).toMatch(/a_t\s*&?\\sim\s*\\pi_\\theta/);
  for (const expression of ["s_{t+1}", "R(\\tau)", "\\gamma"]) {
    expect(chapter).toContain(expression);
  }
  for (const phrase of [
    "hidden environment state",
    "observation history",
    "termination condition",
    "every symbol",
  ]) expect(flat).toContain(phrase);
});

test("the policy objective masks provenance rather than pretending observations are actions", () => {
  for (const expression of [
    "m_j",
    "\\mathcal{L}_{\\mathrm{policy}}",
    "\\log \\pi_\\theta",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "policy-generated token",
    "environment observation",
    "prompt and system tokens",
    "mask is an ownership rule",
  ]) expect(flat).toContain(phrase);
});

test("agent training does not collapse demonstrations, offline data, and online RL", () => {
  for (const phrase of [
    "behavior cloning",
    "selection or offline learning",
    "online rl",
    "hybrid curriculum",
    "cold start",
    "state distribution",
  ]) expect(flat).toContain(phrase);
});

test("group-relative scoring does not claim token-level causality", () => {
  for (const expression of [
    "\\bar{R}",
    "\\widehat{A}_i",
    "\\varepsilon",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "same trajectory-level advantage",
    "does not identify which action caused",
    "step-level reward",
    "value function",
    "counterfactual",
  ]) expect(flat).toContain(phrase);
});

test("reward, environment, and verifier have separate contracts", () => {
  for (const phrase of [
    "transition contract",
    "observation contract",
    "verifier contract",
    "reward contract",
    "reset",
    "seed",
    "environment version",
    "timeout",
    "tenant",
    "held-out verifier",
    "reward hacking",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("the environment *is* the reward function");
});

test("systems accounting separates placement from synchronization", () => {
  for (const phrase of [
    "orthogonal",
    "colocated",
    "separate gpu pools",
    "synchronous",
    "asynchronous",
    "behavior-policy version",
    "staleness",
    "weight transfer",
    "straggler",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("almost always vllm");
  expect(flat).not.toContain("so no memory is duplicated");
});

test("deployment checks cover learning, environment, and system behavior", () => {
  for (const phrase of [
    "task success",
    "tool-call validity",
    "safety violation",
    "proxy reward",
    "environment reset failure",
    "p95",
    "rollout tokens per second",
    "policy lag",
    "matched hardware",
    "matched workload",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes synthetic evidence and market digressions", () => {
  for (const phrase of [
    "/figures/training-agents-to-act-1.svg",
    "silicon valley bets big",
    "don't build an rl environment startup",
    "standard stage of frontier flagship training",
    "exactly as much as the decisive one",
    "~1 step off-policy",
    "near-full utilization",
  ]) expect(flat).not.toContain(phrase);
});
