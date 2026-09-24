// The figure registry: every figure module, by name, as a lazy import. This is
// the one list to edit when adding a figure. The client bundle is built with
// code splitting, so each figure's code (and any data it carries) is fetched
// only by pages that embed it; the build and the tests load every module
// eagerly through index.ts.

import type { AnyFigure } from "./types.ts";

export type FigureLoader = () => Promise<{ default: AnyFigure }>;

export const LOADERS: Readonly<Record<string, FigureLoader>> = {
  "paged-kv-batching": () => import("./paged-kv-batching.ts"),
  roofline: () => import("./roofline.ts"),
  "causal-attention": () => import("./causal-attention.ts"),
  "lost-in-the-middle": () => import("./lost-in-the-middle.ts"),
  "context-compaction": () => import("./context-compaction.ts"),
  "speculative-sampling": () => import("./speculative-sampling.ts"),
  "candidate-tree": () => import("./candidate-tree.ts"),
  "group-relative-rl": () => import("./group-relative-rl.ts"),
  "pass-at-k-boundary": () => import("./pass-at-k-boundary.ts"),
  "pipeline-schedule": () => import("./pipeline-schedule.ts"),
  "float-formats": () => import("./float-formats.ts"),
  "device-mesh": () => import("./device-mesh.ts"),
  "coverage-selection": () => import("./coverage-selection.ts"),
  "difficulty-budget": () => import("./difficulty-budget.ts"),
  "sampling-paths": () => import("./sampling-paths.ts"),
  "flash-attention": () => import("./flash-attention.ts"),
  "kv-head-sharing": () => import("./kv-head-sharing.ts"),
  "hybrid-retrieval": () => import("./hybrid-retrieval.ts"),
  "compute-optimal-allocation": () => import("./compute-optimal-allocation.ts"),
  "scaling-fit-extrapolation": () => import("./scaling-fit-extrapolation.ts"),
  "continuous-batching": () => import("./continuous-batching.ts"),
  "serving-lifecycle": () => import("./serving-lifecycle.ts"),
  "kv-admission": () => import("./kv-admission.ts"),
  "iteration-roofline": () => import("./iteration-roofline.ts"),
  "moe-dispatch": () => import("./moe-dispatch.ts"),
  "recurrent-state": () => import("./recurrent-state.ts"),
  "hybrid-schedule": () => import("./hybrid-schedule.ts"),
  "kv-block-lifecycle": () => import("./kv-block-lifecycle.ts"),
  "trusted-monitoring": () => import("./trusted-monitoring.ts"),
  "oversight-evidence": () => import("./oversight-evidence.ts"),
  "load-latency-knee": () => import("./load-latency-knee.ts"),
  "superposition-toy": () => import("./superposition-toy.ts"),
  "sae-readback": () => import("./sae-readback.ts"),
  "divergence-direction": () => import("./divergence-direction.ts"),
  "acceptance-weighting": () => import("./acceptance-weighting.ts"),
  "block-scaling": () => import("./block-scaling.ts"),
  "horizon-threshold": () => import("./horizon-threshold.ts"),
  "benchmark-headroom": () => import("./benchmark-headroom.ts"),
  "paired-comparison": () => import("./paired-comparison.ts"),
  "binomial-interval": () => import("./binomial-interval.ts"),
  "sft-loss-mask": () => import("./sft-loss-mask.ts"),
  "lora-low-rank": () => import("./lora-low-rank.ts"),
  "task-vector-merge": () => import("./task-vector-merge.ts"),
};
