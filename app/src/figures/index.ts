// Every figure module, loaded. The build (pipeline/figures.ts) and the tests
// read this map; the browser loads figures one at a time through loaders.ts
// so a page never downloads figures it does not show.

import type { AnyFigure } from "./types.ts";
import { LOADERS } from "./loaders.ts";

const loaded = await Promise.all(Object.values(LOADERS).map(async (load) => (await load()).default));

export const FIGURES: ReadonlyMap<string, AnyFigure> = new Map(loaded.map((f) => [f.name, f]));
