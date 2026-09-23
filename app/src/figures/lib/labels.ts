// Text measurement and label placement without a DOM. Widths are estimated
// from per-glyph advances of the reader's UI font (Inter; CJK glyphs are one
// em), which is close enough to lay labels out without collisions at build
// time. Placement is greedy: labels are tried in priority order at candidate
// offsets around their anchor and kept only where they overlap no placed label,
// no obstacle, and stay inside the bounds.

import { el, text as svgText, type Attrs } from "./svg.ts";
import { C } from "./theme.ts";

// Advance widths in em for Inter, grouped by glyph class.
// Calibrated against Chrome's measured SVG text length for Inter at 12 px
// (within about 5 percent on the book's labels).
function advance(ch: string): number {
  const c = ch.codePointAt(0)!;
  if (c >= 0x2e80) return 1.02; // CJK ideographs, kana, full-width punctuation
  if (ch === " ") return 0.28;
  if (/[0-9]/.test(ch)) return 0.56;
  if (/[iljtf.,:;'!|]/.test(ch)) return 0.28;
  if (/[mwMW]/.test(ch)) return 0.88;
  if (/[A-Z]/.test(ch)) return 0.66;
  if (/[−–—=+<>≤≥×÷]/.test(ch)) return 0.62;
  return 0.57;
}

export function textWidth(s: string, size: number): number {
  let em = 0;
  for (const ch of s) em += advance(ch);
  return em * size;
}

export interface Box { x0: number; y0: number; x1: number; y1: number }

export function overlaps(a: Box, b: Box, pad = 1): boolean {
  return a.x0 < b.x1 + pad && b.x0 < a.x1 + pad && a.y0 < b.y1 + pad && b.y0 < a.y1 + pad;
}

// Box of a text run drawn at (x, y) with a given text-anchor, baseline at y.
export function textBox(x: number, y: number, s: string, size: number, anchor: "start" | "middle" | "end" = "start"): Box {
  const w = textWidth(s, size);
  const x0 = anchor === "start" ? x : anchor === "middle" ? x - w / 2 : x - w;
  return { x0, y0: y - size * 0.78, x1: x0 + w, y1: y + size * 0.22 };
}

// Obstacle boxes along a polyline, so labels also keep clear of lines and
// curves, not only of other text: one small box every `step` pixels.
export function lineObstacles(pts: Array<[number, number]>, step = 6, pad = 2): Box[] {
  const out: Box[] = [];
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / step));
    for (let k = 0; k <= n; k++) {
      const x = x0 + ((x1 - x0) * k) / n, y = y0 + ((y1 - y0) * k) / n;
      out.push({ x0: x - pad, y0: y - pad, x1: x + pad, y1: y + pad });
    }
  }
  return out;
}

export type Side = "right" | "left" | "above" | "below" | "above-right" | "below-right" | "above-left" | "below-left";

export interface LabelRequest {
  x: number; // anchor point (the mark being labeled)
  y: number;
  text: string;
  size?: number;
  sides?: Side[]; // candidate sides in preference order
  gap?: number; // distance from the anchor to the text
  priority?: number; // higher places first
  attrs?: Attrs; // extra text attributes (class, fill)
}

export interface PlacedLabel { req: LabelRequest; x: number; y: number; anchor: "start" | "middle" | "end"; box: Box; leader: boolean }

const DEFAULT_SIDES: Side[] = ["right", "above", "left", "below", "above-right", "below-right", "above-left", "below-left"];

function candidate(req: LabelRequest, side: Side, dist: number, size: number) {
  const { x, y } = req;
  const mid = y + size * 0.35; // baseline that centers the text vertically on y
  switch (side) {
    case "right": return { x: x + dist, y: mid, anchor: "start" as const };
    case "left": return { x: x - dist, y: mid, anchor: "end" as const };
    case "above": return { x, y: y - dist, anchor: "middle" as const };
    case "below": return { x, y: y + dist + size * 0.8, anchor: "middle" as const };
    case "above-right": return { x: x + dist * 0.7, y: y - dist * 0.7, anchor: "start" as const };
    case "below-right": return { x: x + dist * 0.7, y: y + dist * 0.7 + size * 0.8, anchor: "start" as const };
    case "above-left": return { x: x - dist * 0.7, y: y - dist * 0.7, anchor: "end" as const };
    case "below-left": return { x: x - dist * 0.7, y: y + dist * 0.7 + size * 0.8, anchor: "end" as const };
  }
}

// Place labels greedily. Each label tries its sides at the base gap, then at
// 2.4x and 4x the gap with a leader line back to the anchor. A label that fits
// nowhere is dropped (returned in `dropped`) so the figure can surface it in a
// tooltip or readout instead of printing it over another mark.
export function placeLabels(reqs: LabelRequest[], bounds: Box, obstacles: Box[] = []): { placed: PlacedLabel[]; dropped: LabelRequest[] } {
  const placed: PlacedLabel[] = [];
  const dropped: LabelRequest[] = [];
  const taken = [...obstacles];
  const order = [...reqs].sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
  for (const req of order) {
    const size = req.size ?? 12;
    const gap = req.gap ?? 6;
    let done = false;
    for (const [dist, leader] of [[gap, false], [gap * 2.4, true], [gap * 4, true]] as const) {
      for (const side of req.sides ?? DEFAULT_SIDES) {
        const c = candidate(req, side, dist, size);
        const box = textBox(c.x, c.y, req.text, size, c.anchor);
        const inside = box.x0 >= bounds.x0 && box.x1 <= bounds.x1 && box.y0 >= bounds.y0 && box.y1 <= bounds.y1;
        if (!inside || taken.some((b) => overlaps(b, box))) continue;
        placed.push({ req, x: c.x, y: c.y, anchor: c.anchor, box, leader });
        taken.push(box);
        done = true;
        break;
      }
      if (done) break;
    }
    if (!done) dropped.push(req);
  }
  return { placed, dropped };
}

// SVG for placed labels, with a short leader line where one was needed.
export function drawLabels(placed: PlacedLabel[]): string {
  return placed.map((p) => {
    const size = p.req.size ?? 12;
    const leader = p.leader
      ? el("line", {
        x1: p.req.x, y1: p.req.y,
        x2: p.anchor === "start" ? p.box.x0 - 2 : p.anchor === "end" ? p.box.x1 + 2 : p.x,
        y2: p.box.y0 > p.req.y ? p.box.y0 : p.box.y1 < p.req.y ? p.box.y1 : p.y - size * 0.35,
        stroke: C.ink3, "stroke-width": 1,
      })
      : "";
    return leader + svgText(p.x, p.y, p.req.text, { "font-size": size, "text-anchor": p.anchor, ...p.req.attrs });
  }).join("");
}

// Split text into wrap units: each CJK glyph alone, Latin words, and spaces.
function wrapUnits(s: string): string[] {
  const out: string[] = [];
  let word = "";
  for (const ch of s) {
    const cjk = ch.codePointAt(0)! >= 0x2e80;
    if (cjk || ch === " ") {
      if (word) out.push(word);
      word = "";
      out.push(ch);
    } else word += ch;
  }
  if (word) out.push(word);
  return out;
}

// Wrap a string to lines no wider than maxWidth (breaks at spaces for Latin
// text and between any two CJK glyphs).
export function wrap(s: string, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const tok of wrapUnits(s)) {
    const next = line + tok;
    if (line && textWidth(next.trimEnd(), size) > maxWidth) {
      lines.push(line.trimEnd());
      line = tok.trimStart();
    } else line = next;
  }
  if (line.trim()) lines.push(line.trimEnd());
  return lines;
}
