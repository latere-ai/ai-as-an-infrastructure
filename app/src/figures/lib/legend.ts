// A legend that wraps to the available width. Swatches carry identity; the
// text stays in ink (never the series color), per the book's figure rules.

import { el, text } from "./svg.ts";
import { textWidth } from "./labels.ts";
import { C, TYPE } from "./theme.ts";

export type Swatch =
  | { kind: "rect"; fill: string; stroke?: string; opacity?: number; dash?: string; pattern?: string }
  | { kind: "line"; stroke: string; dash?: string }
  | { kind: "dot"; fill: string };

export interface LegendItem { label: string; swatch: Swatch }

function swatch(s: Swatch, x: number, y: number, size: number): string {
  switch (s.kind) {
    case "rect":
      return (s.pattern ? el("rect", { x, y: y - size + 2, width: size, height: size - 2, rx: 2, fill: `url(#${s.pattern})` }) : "")
        + el("rect", { x, y: y - size + 2, width: size, height: size - 2, rx: 2, fill: s.pattern ? "none" : s.fill, "fill-opacity": s.opacity, stroke: s.stroke, "stroke-width": s.stroke ? 1.2 : undefined, "stroke-dasharray": s.dash });
    case "line":
      return el("line", { x1: x, x2: x + size + 4, y1: y - size / 2 + 1, y2: y - size / 2 + 1, stroke: s.stroke, "stroke-width": 2, "stroke-dasharray": s.dash, "stroke-linecap": "round" });
    case "dot":
      return el("circle", { cx: x + size / 2, cy: y - size / 2 + 1, r: size / 2 - 1, fill: s.fill });
  }
}

// Lay items out left to right, wrapping at maxWidth. Returns the markup and
// the height used, so the caller can place the next block below it.
export function legend(items: LegendItem[], x: number, y: number, maxWidth: number, size: number = TYPE.small): { svg: string; height: number } {
  const sw = size;
  const rowH = size + 8;
  let cx = x;
  let row = 0;
  const parts: string[] = [];
  for (const it of items) {
    const w = sw + 6 + textWidth(it.label, size) + (it.swatch.kind === "line" ? 4 : 0);
    if (cx > x && cx + w > x + maxWidth) { row++; cx = x; }
    const baseline = y + row * rowH + size;
    parts.push(swatch(it.swatch, cx, baseline, sw));
    parts.push(text(cx + sw + 6 + (it.swatch.kind === "line" ? 4 : 0), baseline, it.label, { "font-size": size, fill: C.ink2 }));
    cx += w + 14;
  }
  return { svg: el("g", { class: "fig-legend" }, ...parts), height: (row + 1) * rowH };
}
