import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/orchestration/02-agent-architectures.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/agent-architectures.bib", import.meta.url),
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
  expect(bibliography).toContain("Proceedings of the 41st International Conference on Machine Learning");
  expect(bibliography).toContain("Proceedings of the 42nd International Conference on Machine Learning");
  expect(bibliography).toContain("Advances in Neural Information Processing Systems 37");
});

test("an agent is defined by a decision loop rather than by one named component list", () => {
  for (const phrase of [
    "controller",
    "assembled context",
    "action interface",
    "environment",
    "state transition",
    "termination rule",
  ]) expect(flat).toContain(phrase);
  expect(flat).toContain("tool calling is one action interface");
  expect(flat).not.toContain("standard four-part decomposition");
  expect(flat).not.toContain("tool use is the one that earns the name agent");
});

test("the formal turn defines decisions, observations, and every stop path", () => {
  for (const expression of [
    "x_t &= \\mathcal{C}",
    "y_t &\\sim \\pi_\\theta",
    "d_t &= \\mathcal{D}",
    "s_{t+1} &= \\mathcal{U}",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "ask the user",
    "return a final response",
    "request an action",
    "success",
    "failure",
    "cancellation",
    "budget exhaustion",
  ]) expect(flat).toContain(phrase);
});

test("planning choices are separated by cadence and feedback", () => {
  for (const phrase of [
    "reactive next action",
    "receding-horizon plan",
    "plan then execute",
    "hierarchical planner and executor",
    "replan trigger",
    "written plan is state",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("this design is clean, legible, and wrong");
  expect(flat).not.toContain("planning the whole task up front bought nothing");
});

test("visible reasoning is optional while action and state remain inspectable", () => {
  for (const phrase of [
    "visible reasoning trace is not required",
    "decision record",
    "action arguments",
    "observation provenance",
    "completion evidence",
  ]) expect(flat).toContain(phrase);
});

test("action representations retain their distinct safety and composition costs", () => {
  for (const phrase of [
    "structured function call",
    "executable code",
    "environment-native action",
    "schema validation",
    "sandbox",
    "reference monitor",
    "idempotency key",
  ]) expect(flat).toContain(phrase);
});

test("context accounting replaces an invented tool-count threshold", () => {
  for (const expression of [
    "B_{\\mathrm{ctx}}",
    "B_{\\mathrm{tools},t}",
    "\\sum_{a\\in A_t}",
  ]) expect(chapter).toContain(expression);
  for (const phrase of [
    "measure selection quality",
    "irrelevant tools",
    "abstention",
    "parallel calls",
    "stateful multi-turn",
  ]) expect(flat).toContain(phrase);
  expect(flat).not.toContain("roughly thirty to fifty tools");
  expect(flat).not.toContain("data-family=\"exp-decay\"");
});

test("evaluation holds the model and operating envelope fixed", () => {
  for (const phrase of [
    "same model checkpoint",
    "same task distribution",
    "same tool implementations",
    "same permissions",
    "same budgets",
    "invalid-action rate",
    "recovery rate",
    "unintended side effects",
  ]) expect(flat).toContain(phrase);
});

test("the rewrite removes synthetic evidence and false universals", () => {
  for (const phrase of [
    "/figures/agent-architectures-1.svg",
    "p ** n",
    "the plan is never written all at once",
    "the only part that lets it reach past the weights",
    "the first capability to mature",
    "mcp session: capabilities",
    "accuracy falls off",
  ]) expect(flat).not.toContain(phrase);
});
