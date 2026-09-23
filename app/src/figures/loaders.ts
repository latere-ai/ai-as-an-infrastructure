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
  "speculative-sampling": () => import("./speculative-sampling.ts"),
  "candidate-tree": () => import("./candidate-tree.ts"),
  "group-relative-rl": () => import("./group-relative-rl.ts"),
};
