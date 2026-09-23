// ```{figure} blocks: a chapter embeds a registered figure module by name.
//
//   ```{figure}
//   //| figure: paged-kv-batching
//   //| label: fig-memory-scheduling-paged-attention
//   //| fig-cap: "Caption, with inline markdown, math, and @refs."
//   rate: 0.5
//   pool: 448
//   ```
//
// Directive lines (//|) name the figure, its cross-reference label, and its
// caption; the other lines set parameters. The block is identical in the en
// and zh trees except for the caption: the language comes from the build.
// Unknown figures, unknown parameters, and out-of-range values fail the build.

import { FIGURES } from "../figures/index.ts";
import { resolve } from "../figures/lib/params.ts";
import { renderStatic } from "../figures/static.ts";
import type { Lang } from "../types.ts";

export interface FigureBlock {
  name: string;
  label?: string;
  cap?: string;
  entries: Record<string, string>;
}

export function parseFigureBlock(code: string): FigureBlock {
  let name = "", label: string | undefined, cap: string | undefined;
  const entries: Record<string, string> = {};
  for (const raw of code.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("//|")) {
      const m = line.slice(3).trim().match(/^([\w-]+):\s*(.*)$/);
      if (!m) throw new Error(`figure block: cannot read directive "${line}"`);
      const [, key, value] = m;
      if (key === "figure") name = value.trim();
      else if (key === "label") label = value.trim();
      else if (key === "fig-cap") cap = value.trim().replace(/^"(.*)"$/, "$1");
      else throw new Error(`figure block: unknown directive "${key}"`);
      continue;
    }
    const m = line.match(/^([\w-]+):\s*(.+)$/);
    if (!m) throw new Error(`figure block: expected "key: value", got "${line}"`);
    entries[m[1]] = m[2].trim();
  }
  if (!name) throw new Error("figure block: missing //| figure: <name>");
  return { name, label, cap, entries };
}

// The figure element: static SVG host plus a numbered caption. `caption`
// renders the caption text (inline markdown) and `number` returns the
// "Figure C.N" label for the block's id.
export function renderFigureBlock(code: string, lang: Lang, caption: (s: string) => string, number: (id: string) => string): string {
  const b = parseFigureBlock(code);
  const fig = FIGURES.get(b.name);
  if (!fig) throw new Error(`figure block: no figure named "${b.name}" (registered: ${[...FIGURES.keys()].join(", ")})`);
  const { p, t } = resolve(fig, b.entries);
  const id = b.label ?? `fig-${b.name}`;
  const host = renderStatic(fig, p, lang, id, t);
  const num = b.label ? number(b.label) : "";
  const numPart = num ? `<span class="rdr-fig-num">${num}.</span> ` : "";
  const cap = b.cap || num ? `<figcaption>${numPart}${b.cap ? caption(b.cap) : ""}</figcaption>` : "";
  const idAttr = b.label ? ` id="${b.label}"` : "";
  return `<figure class="rdr-figure rdr-fig"${idAttr}>${host}${cap}</figure>\n`;
}
