// Bottleneck bars: one horizontal bar per input of a minimum, all in one
// common unit, with the minimum drawn as a line across every bar. The input
// that sets the minimum is the binding one; every other bar splits at the line
// into the part the bound can use and the part it cannot (inventory or
// capacity left unmatched until the binding input grows). An optional
// reference value per row (a plan, or the capacity before a contingency) is
// drawn as a dashed outline so a change reads against it.
//
// Used by ledgers of the form N <= min(x_1, ..., x_k): the package supply
// ledger (inputs in package-equivalents) and the site power ledger (stages in
// IT megawatts). Labels come from the caller, so the primitive carries no
// language.

import { el, text, g } from "./svg.ts";
import { C, TYPE } from "./theme.ts";
import { linear } from "./scale.ts";
import { textWidth, wrap } from "./labels.ts";
import { legend } from "./legend.ts";

export interface BottleneckRow {
  label: string; // the input, in the reader's words
  detail?: string; // the conversion into the common unit, e.g. "⌊7,200 / 2⌋"
  value: number; // in the common unit
  ref?: number; // reference value in the same unit, drawn as a dashed outline
  hit?: string; // data-fig-set assignment for a click on the row
}

export interface BottleneckOptions {
  x: number;
  y: number;
  w: number;
  fmt: (v: number) => string; // value label in the common unit
  boundLabel: string; // text over the minimum line, already formatted
  legend: { binding: string; used: string; unused: string; ref?: string };
  max?: number; // scale maximum; defaults to the largest value or reference
}

export interface BottleneckResult { svg: string; h: number; bind: number; next: number }

// Index of the smallest value (the first one on a tie) and of the next
// smallest, which binds once the first is relieved.
export function binding(values: number[]): { bind: number; next: number } {
  let bind = 0;
  for (let i = 1; i < values.length; i++) if (values[i] < values[bind]) bind = i;
  let next = -1;
  for (let i = 0; i < values.length; i++) if (i !== bind && (next < 0 || values[i] < values[next])) next = i;
  return { bind, next };
}

export function bottleneckBars(rows: BottleneckRow[], o: BottleneckOptions): BottleneckResult {
  const narrow = o.w < 480;
  const fs = TYPE.body;
  const { bind, next } = binding(rows.map((r) => r.value));
  const bound = rows[bind].value;
  const parts: string[] = [];

  const lg = legend([
    { label: o.legend.binding, swatch: { kind: "rect", fill: C.c2 } },
    { label: o.legend.used, swatch: { kind: "rect", fill: C.c1 } },
    { label: o.legend.unused, swatch: { kind: "rect", fill: C.c1, opacity: 0.28 } },
    ...(o.legend.ref && rows.some((r) => r.ref != null && Math.abs(r.ref - r.value) > 1e-9)
      ? [{ label: o.legend.ref, swatch: { kind: "rect" as const, fill: "none", stroke: C.ink, dash: "3 2" } }] : []),
  ], o.x, o.y, o.w, fs);
  parts.push(lg.svg);

  // Columns. Desktop: label and conversion to the left of the bar. Phone: the
  // label and conversion sit on their own lines above a full-width bar.
  const labelW = narrow ? 0 : Math.min(o.w * 0.4, Math.max(...rows.map((r) => Math.max(textWidth(r.label, fs), textWidth(r.detail ?? "", fs)))) + 14);
  const valW = Math.max(...rows.map((r) => textWidth(o.fmt(r.value), fs))) + 10;
  const bx0 = o.x + labelW;
  const bx1 = o.x + o.w - valW;
  const max = o.max ?? Math.max(...rows.map((r) => Math.max(r.value, r.ref ?? 0))) * 1.02;
  const xs = linear([0, max], [bx0, bx1]);
  const barH = narrow ? 16 : 18;
  const rowH = narrow ? 58 : 40;
  const top = o.y + lg.height + 26; // room for the bound label over the line

  const rowsSvg: string[] = [];
  rows.forEach((r, i) => {
    const y0 = top + i * rowH;
    const isBind = i === bind;
    const barY = narrow ? y0 + 34 : y0 + (rowH - barH) / 2 - 2;
    const cls = isBind ? "fig-t-strong" : "";
    if (narrow) {
      rowsSvg.push(text(o.x, y0 + 13, r.label, { "font-size": fs, class: cls || undefined }));
      if (r.detail) rowsSvg.push(text(o.x, y0 + 28, r.detail, { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    } else {
      rowsSvg.push(text(o.x, barY + 6, r.label, { "font-size": fs, class: cls || undefined }));
      if (r.detail) rowsSvg.push(text(o.x, barY + 22, r.detail, { "font-size": fs, class: "fig-t-muted fig-t-num" }));
    }
    rowsSvg.push(el("rect", { x: bx0, y: barY, width: bx1 - bx0, height: barH, rx: 3, fill: C.panel }));
    const xv = xs(Math.max(0, r.value));
    const xb = xs(Math.max(0, Math.min(r.value, bound)));
    if (isBind) {
      rowsSvg.push(el("rect", { x: bx0, y: barY, width: Math.max(1, xv - bx0), height: barH, rx: 3, fill: C.c2 }));
    } else {
      rowsSvg.push(el("rect", { x: bx0, y: barY, width: Math.max(1, xb - bx0), height: barH, rx: 3, fill: C.c1 }));
      if (xv > xb + 0.5) rowsSvg.push(el("rect", { x: xb, y: barY, width: xv - xb, height: barH, fill: C.c1, "fill-opacity": 0.28 }));
    }
    if (r.ref != null && Math.abs(r.ref - r.value) > 1e-9) {
      const xr = xs(Math.max(0, r.ref));
      rowsSvg.push(el("rect", { x: bx0 + 0.75, y: barY + 0.75, width: Math.max(1, xr - bx0 - 1.5), height: barH - 1.5, rx: 3, fill: "none", stroke: C.ink, "stroke-width": 1.5, "stroke-dasharray": "3 2" }));
    }
    const xl = Math.max(xv, r.ref != null ? xs(Math.max(0, r.ref)) : 0);
    rowsSvg.push(text(Math.min(xl + 6, bx1 + 6), barY + barH / 2 + fs * 0.35, o.fmt(r.value), { "font-size": fs, class: `fig-t-num${isBind ? " fig-t-strong" : ""}` }));
    if (r.hit) rowsSvg.push(el("rect", { x: o.x, y: y0, width: o.w, height: rowH, fill: "transparent", "data-fig-set": r.hit, class: "fig-hit" }));
  });
  parts.push(g({ class: "fig-bottleneck-rows" }, ...rowsSvg));

  // The minimum as a line across every bar, labeled at the top.
  const xm = xs(bound);
  const yEnd = top + rows.length * rowH - (narrow ? 6 : 8);
  if (narrow) {
    // On a phone the row labels sit above the bars, so the line is drawn only
    // across the bars and never through the text.
    rows.forEach((_, i) => {
      const barY = top + i * rowH + 34;
      parts.push(el("line", { x1: xm, x2: xm, y1: barY - 4, y2: barY + barH + 4, stroke: C.ink, "stroke-width": 1.5 }));
    });
    parts.push(el("line", { x1: xm, x2: xm, y1: top - 8, y2: top - 2, stroke: C.ink, "stroke-width": 1.5 }));
  } else {
    parts.push(el("line", { x1: xm, x2: xm, y1: top - 8, y2: yEnd, stroke: C.ink, "stroke-width": 1.5 }));
  }
  const lines = wrap(o.boundLabel, fs, o.w);
  const lw = textWidth(lines[0], fs);
  const anchor = xm + lw / 2 > o.x + o.w ? "end" : xm - lw / 2 < o.x ? "start" : "middle";
  const lx = anchor === "end" ? Math.min(xm + 8, o.x + o.w) : anchor === "start" ? Math.max(xm - 8, o.x) : xm;
  parts.push(text(lx, top - 13, lines[0], { "font-size": fs, "text-anchor": anchor, class: "fig-t-strong fig-t-num" }));

  return { svg: g({ class: "fig-bottleneck" }, ...parts), h: yEnd - o.y + 8, bind, next };
}
