import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/adaptation/03-rlhf-reward-modeling.qmd", import.meta.url),
  "utf8",
);
const overoptimizationFigure = readFileSync(
  new URL("../../figures-src/rlhf-reward-modeling-1.py", import.meta.url),
  "utf8",
);

test("RLHF chapter separates the learned judge from the policy update", () => {
  const flat = chapter.replace(/\s+/g, " ");
  const required = [
    "RLHF learns a judge, then trains a policy",
    "Train a scorer from comparisons",
    "Pairwise training fixes differences, not absolute quality",
    "The policy objective has two terms",
    "KL and PPO clipping constrain different moves",
    "Four roles participate in the loop",
    "Optimization tests the proxy outside its training distribution",
    "What the controls can and cannot do",
    "Use external judgment to decide when to stop",
    "Lower-layer constraint",
    "rank=same",
    "constraint=false",
  ];
  for (const phrase of required) expect(flat).toContain(phrase);

  const rejected = [
    "annotator disagreement is the noise floor",
    "The KL term is the main reason RLHF is stable",
    "per-token gap between policy and reference is the KL",
    "the bottleneck was not capability but the elicitation",
    "Human comparisons are the highest-fidelity preference signal",
    "The pipeline is a set of balances, each with a knee",
    "most disclosed frontier and open post-training stacks now run",
    "subgraph cluster_rollout",
  ];
  for (const phrase of rejected) expect(chapter).not.toContain(phrase);
});

test("reward and KL equations define the quantities the prose relies on", () => {
  const flat = chapter.replace(/\s+/g, " ");
  for (const phrase of [
    "\\mathcal{D}=\\{(x_i,y_i^+,y_i^-)\\}_{i=1}^N",
    "\\mathcal{L}_{\\mathrm{RM}}(\\phi)",
    "c(x)",
    "not be compared across prompts",
    "A sampled log-ratio is not itself the KL divergence",
    "\\pi_{\\mathrm{old}}",
    "reward scale and $\\beta$ must be recorded together",
  ]) {
    expect(flat).toContain(phrase);
  }
});

test("over-optimization evidence is described as a synthetic proxy experiment", () => {
  const flat = chapter.replace(/\s+/g, " ");
  for (const phrase of [
    "fixed gold reward model stood in for human judgment",
    "does not measure a universal curve of true human quality",
    "held-out human or task evaluation",
  ]) {
    expect(flat).toContain(phrase);
  }

  expect(overoptimizationFigure).toContain('label="independent gold-model score"');
  expect(overoptimizationFigure).toContain("gold = 0.45 + 0.16 * shift - curvature * shift**2");
  expect(overoptimizationFigure).not.toContain('label="true quality"');
});
