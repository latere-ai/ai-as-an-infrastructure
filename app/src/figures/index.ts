// The figure registry: every figure module, by name. A chapter embeds a figure
// by this name; the build renders it through this map and the client bundle
// hydrates through the same map, so a figure is registered exactly once here.

import type { AnyFigure } from "./types.ts";
import pagedKvBatching from "./paged-kv-batching.ts";
import roofline from "./roofline.ts";

const ALL: AnyFigure[] = [pagedKvBatching, roofline];

export const FIGURES: ReadonlyMap<string, AnyFigure> = new Map(ALL.map((f) => [f.name, f]));
