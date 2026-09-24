// Diagram rendering. Graphviz (```{dot}```) is rendered to inline SVG at build
// time via @hpcc-js/wasm (no system dependency), themed from the palette. It
// supports Pandoc-style //| label: and //| fig-cap: directives and becomes a
// numbered <figure> via the crossref map.
//
// A Graphviz figure scales with the reading column. Its SVG is as wide as the
// column up to its natural size, and no narrower than the width at which its
// smallest text renders at MIN_TEXT_PX; below that the diagram scrolls. When
// the natural layout cannot fit a column at that size, the build lays the
// graph out again with narrow-layout options (diagram-source.ts) and ships the
// layout that fits the desktop column and the one that fits the phone column;
// a container query in theme.css shows one of them.

import { Graphviz } from "@hpcc-js/wasm";
import type { CrossrefMap } from "./crossref.ts";
import { resolveXrefsInText } from "./crossref.ts";
import { themeClasses } from "./diagram-color.ts";
import { mirrorVertically, orderReversed } from "./diagram-geometry.ts";
import { prepareDot, type LayoutOptions } from "./diagram-source.ts";

export type GraphvizInstance = Awaited<ReturnType<typeof Graphviz.load>>;

export async function loadGraphviz(): Promise<GraphvizInstance> {
  return await Graphviz.load();
}

// Graphviz lays out in points and the SVG maps one point to 4/3 CSS px.
const PX_PER_PT = 4 / 3;
// The smallest size diagram text is scaled down to, as for figure modules.
export const MIN_TEXT_PX = 11;
// Reading-column widths at a 1280 px and a 390 px viewport; the narrow layout
// is shown in columns under 480 px (theme.css).
export const DESKTOP_COLUMN_PX = 614;
export const PHONE_COLUMN_PX = 312;

// Layouts tried, in order, when the natural layout does not fit a column. The
// first that fits wins. Wrapping labels keeps the graph's shape, so the widest
// wraps come first; flipping the rank axis and dropping rank=same rows change
// the arrangement and come last.
const NARROW_LAYOUTS: LayoutOptions[] = [
  { wrapEm: 14 },
  { wrapEm: 11 },
  { wrapEm: 9 },
  { wrapEm: 9, tight: true },
  { wrapEm: 7, tight: true },
  { wrapEm: 5.5, tight: true },
  { flip: true },
  { flip: true, wrapEm: 9, tight: true },
  { unrank: true, wrapEm: 9, tight: true },
  { unrank: true, wrapEm: 7, tight: true },
  { unrank: true, wrapEm: 5.5, tight: true },
  { unrank: true, flip: true, wrapEm: 9, tight: true },
];

// Pull `//| key: value` directive lines off the top of a diagram body.
function extractDirectives(code: string): { body: string; label?: string; cap?: string } {
  const lines = code.split("\n");
  const kept: string[] = [];
  let label: string | undefined, cap: string | undefined;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith("//|")) {
      const rest = t.slice(3).trim();
      const mLabel = rest.match(/^label:\s*(\S+)/);
      const mCap = rest.match(/^fig-cap:\s*"?(.*?)"?$/);
      if (mLabel) { label = mLabel[1]; continue; }
      if (mCap) { cap = mCap[1]; continue; }
      continue; // ignore other directives
    }
    kept.push(line);
  }
  return { body: kept.join("\n").trim(), label, cap };
}

function figureWrap(inner: string, label: string | undefined, cap: string | undefined, xref: CrossrefMap, currentHref: string, prefix: string): string {
  const id = label ? ` id="${label}"` : "";
  let caption = "";
  if (cap || label) {
    const num = label ? xref.get(label)?.label : "";
    const numPart = num ? `<span class="rdr-fig-num">${num}.</span> ` : "";
    const capHtml = cap ? resolveXrefsInText(cap, xref, currentHref, prefix) : "";
    caption = `<figcaption>${numPart}${capHtml}</figcaption>`;
  }
  return `<figure class="rdr-figure"${id}>${inner}${caption}</figure>`;
}

function escapeAttribute(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// One compiled layout: the options it was laid out with, the SVG body
// (preamble dropped, colors classed), its natural width and height in CSS px,
// and the narrowest width it may be scaled to before its smallest text drops
// below MIN_TEXT_PX.
export interface DotLayout { options: LayoutOptions; svg: string; width: number; height: number; minWidth: number }

const round = (n: number) => Math.round(n * 100) / 100;

function compile(gv: GraphvizInstance, body: string, options: LayoutOptions = {}): DotLayout {
  let svg = gv.dot(prepareDot(body, options), "svg");
  const i = svg.indexOf("<svg"); // drop the <?xml?> + DOCTYPE preamble for inline HTML
  if (i > 0) svg = svg.slice(i);
  const widthPt = Number(svg.match(/^<svg[^>]*\swidth="([\d.]+)pt"/)?.[1]);
  const heightPt = Number(svg.match(/^<svg[^>]*\sheight="([\d.]+)pt"/)?.[1]);
  const width = round(widthPt * PX_PER_PT);
  const height = round(heightPt * PX_PER_PT);
  svg = svg.replace(/^<svg([^>]*)\swidth="[\d.]+pt"\s+height="[\d.]+pt"/, `<svg$1 width="${width}" height="${height}"`);
  const scale = Number(svg.match(/<g id="graph0"[^>]*transform="scale\(([\d.]+)/)?.[1] ?? 1);
  const sizes = [...svg.matchAll(/<text\b[^>]*\sfont-size="([\d.]+)"/g)].map((m) => Number(m[1]) * scale * PX_PER_PT);
  const smallest = sizes.length ? Math.min(...sizes) : Infinity;
  const minWidth = round(width * Math.min(1, MIN_TEXT_PX / smallest));
  return { options, svg: themeClasses(svg), width, height, minWidth };
}

// The layout to show in a column: the natural one when it fits, else the first
// narrow layout that fits. When none fits, the diagram scrolls, and a later
// (more rearranged) layout replaces an earlier one only when it scrolls
// clearly less, by a tenth of the width or more.
function pick(layouts: Array<() => DotLayout | null>, column: number): DotLayout {
  let best: DotLayout | null = null;
  for (const get of layouts) {
    const l = get();
    if (!l) continue;
    if (l.minWidth <= column) return l;
    if (!best || l.minWidth < best.minWidth * 0.9) best = l;
  }
  return best!;
}

// Layouts for the desktop and the phone column; the same object when one
// layout serves both.
export function layoutDot(gv: GraphvizInstance, body: string): { wide: DotLayout; narrow: DotLayout } {
  const natural = compile(gv, body);
  const cache = new Map<LayoutOptions, DotLayout | null>();
  const candidates = [() => natural, ...NARROW_LAYOUTS.map((opts) => () => {
    if (!cache.has(opts)) {
      // A rewritten source can crash Graphviz where the original compiles (a
      // wrapped record label did); such a layout is skipped.
      try {
        let l = compile(gv, body, opts);
        if (opts.flip && orderReversed(natural.svg, l.svg)) {
          l = compile(gv, body, { ...opts, invertLabels: true });
          l.svg = mirrorVertically(l.svg);
        }
        cache.set(opts, l);
      } catch { cache.set(opts, null); }
    }
    return cache.get(opts)!;
  })];
  return { wide: pick(candidates, DESKTOP_COLUMN_PX), narrow: pick(candidates, PHONE_COLUMN_PX) };
}

function svgElement(layout: DotLayout, name: string, cls?: string): string {
  const attrs = [
    cls ? ` class="${cls}"` : "",
    ` role="img" aria-label="${name}"`,
    ` style="max-width:${layout.width}px;min-width:${layout.minWidth}px"`,
  ].join("");
  return layout.svg.replace("<svg", `<svg${attrs}`);
}

export function renderDot(gv: GraphvizInstance, code: string, xref: CrossrefMap, currentHref: string, prefix: string): string {
  const { body, label, cap } = extractDirectives(code);
  const name = escapeAttribute(cap || label || "Diagram");
  let inner: string;
  try {
    const { wide, narrow } = layoutDot(gv, body);
    inner = wide === narrow
      ? svgElement(wide, name)
      : svgElement(wide, name, "rdr-dg-wide") + svgElement(narrow, name, "rdr-dg-narrow");
  } catch (e) { inner = `<pre class="rdr-diagram-error">graphviz error: ${String(e)}</pre>`; }
  return figureWrap(`<div class="rdr-diagram">${inner}</div>`, label, cap, xref, currentHref, prefix);
}
