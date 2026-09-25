// Shared pieces of the cover drawings: the face size, layer and text builders,
// and the book data a cover can draw from.
//
// Every drawing is a stack of SVG layers over one 700 x 990 viewBox (the
// A-series ratio of a printed cover). A layer carries its depth --d, and the
// stylesheet shifts it by that depth as the book turns, which is the parallax.

import { esc, r } from "../../figures/lib/svg.ts";

export const W = 700;
export const H = 990;

// One part of the book, as the cover lists it: its number ("0", "IX") and
// title without the "Part N:" prefix.
export interface CoverPart {
  num: string;
  title: string;
}

// The newest released version in CHANGELOG.md.
export interface Release {
  version: string; // "0.9.1"
  date: string; // "2026-09-25"
}

export interface CoverData {
  parts: CoverPart[];
  release: Release | null;
}

export function layer(name: string, depth: number, body: string, defs = ""): string {
  return `<svg class="cv-l cv-l-${name}" style="--d:${depth}" viewBox="0 0 ${W} ${H}" aria-hidden="true" focusable="false">`
    + (defs ? `<defs>${defs}</defs>` : "") + body + `</svg>`;
}

export function txt(x: number, y: number, s: string, cls: string, extra = ""): string {
  return `<text class="${cls}" x="${r(x)}" y="${r(y)}"${extra}>${esc(s)}</text>`;
}

// Text with presentation attributes, for the drawings that size type inline.
export function T(x: number, y: number, s: string, a: Record<string, string | number | undefined> = {}): string {
  let attrs = "";
  for (const [k, v] of Object.entries(a)) if (v !== undefined) attrs += ` ${k}="${typeof v === "number" ? r(v) : esc(v)}"`;
  return `<text x="${r(x)}" y="${r(y)}"${attrs}>${esc(s)}</text>`;
}

export const stop = (offset: number, token: string, opacity?: number) =>
  `<stop offset="${offset}" style="stop-color:var(--cv-${token})${opacity != null ? `;stop-opacity:${opacity}` : ""}"/>`;

export const vgrad = (id: string, stops: string) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`;

// Break a title into lines of at most `max` characters at spaces. A word
// longer than the limit keeps its own line rather than being cut.
export function wrap(s: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of s.split(" ")) {
    if (line && line.length + 1 + word.length > max) { lines.push(line); line = word; }
    else line = line ? `${line} ${word}` : word;
  }
  if (line) lines.push(line);
  return lines;
}

// A smooth path through points (Catmull-Rom as cubic Bezier segments).
export function smooth(pts: Array<[number, number]>): string {
  let d = `M${r(pts[0][0])} ${r(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${r(c1[0])} ${r(c1[1])} ${r(c2[0])} ${r(c2[1])} ${r(p2[0])} ${r(p2[1])}`;
  }
  return d;
}
