// Axes drawn from a Scale: tick marks at real data values, tick labels in
// domain units, optional gridlines across the plot, and an axis title that
// names the quantity and its unit. Tick labels that would collide with their
// neighbor are thinned rather than overprinted.

import type { Scale } from "./scale.ts";
import { el, text } from "./svg.ts";
import { textWidth } from "./labels.ts";
import { compact } from "./format.ts";
import { C, TYPE } from "./theme.ts";

export interface AxisOptions {
  scale: Scale;
  orient: "bottom" | "left";
  at: number; // y of a bottom axis, x of a left axis
  ticks?: number[]; // override tick values
  format?: (v: number) => string;
  title?: string;
  grid?: [number, number]; // extent of gridlines across the plot (y0,y1 for bottom; x0,x1 for left)
  minor?: boolean; // draw unlabeled minor ticks (log scales)
  size?: number;
}

export function axis(o: AxisOptions): string {
  const size = o.size ?? TYPE.small;
  const fmt = o.format ?? compact;
  const values = o.ticks ?? o.scale.ticks(o.orient === "bottom" ? 6 : 5);
  const [r0, r1] = o.scale.range;
  const parts: string[] = [];
  const horizontal = o.orient === "bottom";

  // Gridlines first so ticks and data sit above them.
  if (o.grid) {
    const [g0, g1] = o.grid;
    for (const v of values) {
      const p = o.scale(v);
      parts.push(horizontal
        ? el("line", { x1: p, x2: p, y1: g0, y2: g1, stroke: C.grid, "stroke-width": 1 })
        : el("line", { x1: g0, x2: g1, y1: p, y2: p, stroke: C.grid, "stroke-width": 1 }));
    }
  }
  parts.push(horizontal
    ? el("line", { x1: Math.min(r0, r1), x2: Math.max(r0, r1), y1: o.at, y2: o.at, stroke: C.rule, "stroke-width": 1 })
    : el("line", { x1: o.at, x2: o.at, y1: Math.min(r0, r1), y2: Math.max(r0, r1), stroke: C.rule, "stroke-width": 1 }));

  if (o.minor && o.scale.kind === "log") {
    for (const v of o.scale.minorTicks()) {
      const p = o.scale(v);
      parts.push(horizontal
        ? el("line", { x1: p, x2: p, y1: o.at, y2: o.at + 3, stroke: C.rule, "stroke-width": 1 })
        : el("line", { x1: o.at - 3, x2: o.at, y1: p, y2: p, stroke: C.rule, "stroke-width": 1 }));
    }
  }

  // Thin labels: keep a label only if it clears the previous kept one.
  let lastEdge = -Infinity;
  const sorted = [...values].sort((a, b) => o.scale(a) - o.scale(b));
  for (const v of sorted) {
    const p = o.scale(v);
    const label = fmt(v);
    parts.push(horizontal
      ? el("line", { x1: p, x2: p, y1: o.at, y2: o.at + 5, stroke: C.rule, "stroke-width": 1 })
      : el("line", { x1: o.at - 5, x2: o.at, y1: p, y2: p, stroke: C.rule, "stroke-width": 1 }));
    const extent = horizontal ? textWidth(label, size) : size;
    const lo = p - extent / 2;
    if (lo < lastEdge + 4) continue;
    lastEdge = p + extent / 2;
    parts.push(horizontal
      ? text(p, o.at + 7 + size, label, { "font-size": size, "text-anchor": "middle", class: "fig-t-num" })
      : text(o.at - 8, p + size * 0.35, label, { "font-size": size, "text-anchor": "end", class: "fig-t-num" }));
  }

  if (o.title) {
    parts.push(horizontal
      ? text((r0 + r1) / 2, o.at + 12 + size * 2.2, o.title, { "font-size": size, "text-anchor": "middle", class: "fig-t-muted" })
      : text(o.at, Math.min(r0, r1) - 10, o.title, { "font-size": size, "text-anchor": "start", class: "fig-t-muted" }));
  }
  return el("g", { class: "fig-axis" }, ...parts);
}

// Space a bottom axis needs below its baseline (ticks, labels, and title).
export function axisHeight(withTitle: boolean, size: number = TYPE.small): number {
  return 12 + size + (withTitle ? size * 1.6 + 4 : 0);
}
