import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const chapter = readFileSync(
  new URL("../../en/evaluation/06-evaluating-agents.qmd", import.meta.url),
  "utf8",
);
const bibliography = readFileSync(
  new URL("../../refs/evaluating-agents.bib", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\s+/g, " ").toLowerCase();

test("the opening separates claims from completed work", () => {
  for (const phrase of [
    "does not merely produce an answer",
    "the environment state and retained action log",
    "evidence about what it *did*",
    "evaluate the versioned system",
    "verify the resulting state",
    "genuine process constraints",
  ]) expect(flat).toContain(phrase);
});

test("the historical background connects episodes to executable environments", () => {
  for (const phrase of [
    "predates language models",
    "policy interacting with an environment over an episode",
    "specifying which real-world state counts as success",
    "agentbench",
    "webarena",
    "swe-bench",
    "osworld",
    "gaia",
    "do not measure one interchangeable quantity",
  ]) expect(flat).toContain(phrase);
});

test("the system boundary pins every execution layer", () => {
  for (const phrase of [
    "model revision, serving route, decoding settings",
    "system prompt, tool descriptions, orchestration loop",
    "credentials, permissions, and network policy",
    "sandbox image, dependency versions, initial data",
    "simulated user if any, time or turn budget",
    "report such a result as a *system* result",
    "configuration, rather than either component in isolation",
  ]) expect(flat).toContain(phrase);
});

test("task definitions and stochastic runs remain separate records", () => {
  for (const field of [
    "initial_state_fixture",
    "reset_check",
    "hard_process_constraints",
    "outcome_assertions",
    "partial_credit_rubric",
    "system_spec_hash",
    "initial_state_hash",
    "observation_action_log",
    "final_state_hash",
    "terminal_reason",
    "infrastructure_status",
  ]) expect(flat).toContain(field);
  expect(flat).toContain("separates the task definition from one stochastic attempt");
  expect(flat).toContain("a simulated user is part of the instrument");
  expect(flat).toContain("compare a subset of simulated interactions with representative humans");
});

test("the formal trajectory defines every symbol", () => {
  for (const phrase of [
    "\\tau_{ir}=(s_0,o_0,a_1,o_1,\\ldots,a_t,s_t)",
    "$i$ identifies the task",
    "$r$ identifies a repeated attempt",
    "$s_0$ and $s_t$ are the initial and final environment states",
    "$o_t$ is the observation available",
    "$a_t$ is the action chosen",
    "$t$ is the step at which the run terminates",
  ]) expect(flat).toContain(phrase);
});

test("required success combines outcomes with only hard constraints", () => {
  for (const phrase of [
    "g_i(s_0,s_t)\\in\\{0,1\\}",
    "c_{ij}(\\tau_{ir})\\in\\{0,1\\}",
    "y_{ir}=g_i(s_0,s_t)\\prod_{j=1}^{j_i} c_{ij}(\\tau_{ir})",
    "empty product is one",
    "does **not** require the agent to follow an author's preferred route",
    "only those intermediate facts that are part of the real requirement",
  ]) expect(flat).toContain(phrase);
});

test("signals retain their appropriate roles", () => {
  for (const phrase of [
    "final environment state",
    "hard trajectory constraints",
    "authorization, safety, ordering, prohibited actions",
    "partial-credit rubric",
    "efficiency, usually conditional on validity",
    "transcript and tool trace",
    "independent of the agent's output channel",
    "not an independent state check merely because",
  ]) expect(flat).toContain(phrase);
});

test("task and grader validation exercise positive and negative cases", () => {
  for (const phrase of [
    "solvable from the information and permissions given",
    "accept more than the reference path",
    "known bad solutions must fail",
    "reset must restore every state",
    "produced a 500-case verified subset",
    "grader is software and needs tests, versioning, and continuing review",
    "preserve the binary end-to-end completion rate",
  ]) expect(flat).toContain(phrase);
});

test("terminal reasons distinguish behavior from broken measurement", () => {
  for (const phrase of [
    "agent failure",
    "harness compatibility failure",
    "environment failure",
    "grader failure",
    "compatibility failures belong to the system configuration",
    "predeclare the policy",
    "health probes that justify each exclusion",
    "fail the batch when reset checks",
  ]) expect(flat).toContain(phrase);
});

test("repeated-trial metrics answer different questions", () => {
  for (const phrase of [
    "p_i=\\pr_r(y_{ir}=1)",
    "\\operatorname{pass@}k_i = 1-(1-p_i)^k",
    "\\operatorname{pass}^k_i = p_i^k",
    "at least one success in $k$ attempts",
    "all $k$ attempts succeed",
    "neither metric creates new tasks",
    "final database state against an annotated goal",
  ]) expect(flat).toContain(phrase);
});

test("finite-sample reliability is estimated per task", () => {
  for (const phrase of [
    "n$ valid attempts",
    "$c_i$ observed successes",
    "\\binom{n-c_i}{k}",
    "\\binom{c_i}{k}",
    "average these task-level estimates",
    "repetitions nested inside tasks",
    "do not compute pass$^k$ by raising a pooled suite accuracy",
  ]) expect(flat).toContain(phrase);
});

test("reliability formulas use separate mobile-safe display blocks", () => {
  expect(chapter).toContain(
    "\\operatorname{pass@}k_i = 1-(1-p_i)^k.\n$$\n\n$$\n\\operatorname{pass}^k_i = p_i^k.",
  );
  expect(chapter).toContain(
    "\\binom{n}{k}}.\n$$\n\n$$\n\\widehat{\\operatorname{pass}^k}_i",
  );
  expect(chapter).not.toContain("\\qquad\n\\operatorname{pass}^k_i");
});

test("traces support diagnosis without post-hoc score repair", () => {
  for (const phrase of [
    "traces can locate where the system failed",
    "state-changing events",
    "perception, planning, tool selection, invalid arguments",
    "do not assign a root cause from the final outcome alone",
    "allow multiple contributing labels",
    "confirmed evaluator defects into regression tests",
    "not to rescue a preferred score",
  ]) expect(flat).toContain(phrase);
});

test("the operating contract and cross-layer handoffs remain complete", () => {
  expect(chapter).toContain(
    "# Evaluating Agents and Capabilities {#sec-evaluating-agents}",
  );
  expect(chapter).toMatch(/## What's contested/i);
  expect(chapter).toMatch(/## Lower-layer constraint/i);
  expect(chapter).toContain("@sec-the-harness");
  expect(chapter).toContain("@sec-judging-holistic");
  expect(chapter).toContain("@sec-statistical-reliability");
  expect(chapter).toContain("@sec-operational-evaluation");
  expect(chapter).toContain("::: {#further-reading}");
  expect(flat).toContain("locked confirmation suite");
  expect(flat).toContain("every aggregate can be reconstructed");
});

test("the bibliography uses primary or archival records", () => {
  for (const marker of [
    "mitpress.mit.edu/9780262039246/reinforcement-learning",
    "e9df36b21ff4ee211a8b71ee8b7e9f57",
    "4410c0711e9154a7a2d26f9b3816d1ef",
    "edac78c3e300629acfe6cbe9ca88fb84",
    "5d413e48f84dc61244b6be550f1cd8f5",
    "25ae35b5b1738d80f1f03a8713e405ec",
    "arxiv.org/abs/2504.01848",
    "arxiv.org/abs/2605.27922",
    "arxiv.org/abs/2504.08942",
    "arxiv.org/abs/2406.12045",
  ]) expect(bibliography.toLowerCase()).toContain(marker);
});

test("the previous product-specific and logically weak detour is absent", () => {
  for (const phrase of [
    "adversarial review, shipped",
    "a shipped instance in latere",
    "forked review, never in the root session",
    "verbatim channel",
    "self-declared topics",
    "persisted ledger",
    "shared blind spot",
    "the judging layer is statistical, not neural",
    "one competent honest critic suffices",
    "built to disagree with the agent",
  ]) expect(flat).not.toContain(phrase);
});

test("the agent-evaluation diagram fits the mobile reading column", async () => {
  const blocks = [...chapter.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBeGreaterThan(0);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    const svg = graphviz.dot(withNodeMargin(block[1]), "svg");
    const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
