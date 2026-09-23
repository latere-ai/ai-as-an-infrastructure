// Diagram rendering. Graphviz (```{dot}```) is rendered to inline SVG at build
// time via @hpcc-js/wasm (no system dependency). Mermaid (```{mermaid}```) is
// emitted as <pre class="mermaid"> and rendered client-side,
// themed from the palette. Both support Pandoc-style //| label: / %%| label: and
// fig-cap: directives and become numbered <figure>s via the crossref map.
//
// A Graphviz figure scales with the reading column. Its SVG is as wide as the
// column up to its natural size, and no narrower than the width at which its
// smallest text renders at MIN_TEXT_PX; below that the diagram scrolls.

import { Graphviz } from "@hpcc-js/wasm";
import type { CrossrefMap } from "./crossref.ts";
import { resolveXrefsInText } from "./crossref.ts";
import { themeClasses } from "./diagram-color.ts";
import { prepareDot } from "./diagram-source.ts";

export type GraphvizInstance = Awaited<ReturnType<typeof Graphviz.load>>;

export async function loadGraphviz(): Promise<GraphvizInstance> {
  return await Graphviz.load();
}

// Graphviz lays out in points and the SVG maps one point to 4/3 CSS px.
const PX_PER_PT = 4 / 3;
// The smallest size diagram text is scaled down to, as for figure modules.
export const MIN_TEXT_PX = 11;
// Reading-column width at a 390 px viewport.
export const PHONE_COLUMN_PX = 312;

// Pull `//| key: value` (dot) or `%%| key: value` (mermaid) directive lines off
// the top of a diagram body.
function extractDirectives(code: string, marker: "//|" | "%%|"): { body: string; label?: string; cap?: string } {
  const lines = code.split("\n");
  const kept: string[] = [];
  let label: string | undefined, cap: string | undefined;
  for (const line of lines) {
    const t = line.trim();
    if (t.startsWith(marker)) {
      const rest = t.slice(marker.length).trim();
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

// One compiled layout: the SVG body (preamble dropped, colors classed), its
// natural width and height in CSS px, and the narrowest width it may be scaled
// to before its smallest text drops below MIN_TEXT_PX.
export interface DotLayout { svg: string; width: number; height: number; minWidth: number }

const round = (n: number) => Math.round(n * 100) / 100;

function compile(gv: GraphvizInstance, body: string): DotLayout {
  let svg = gv.dot(prepareDot(body), "svg");
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
  return { svg: themeClasses(svg), width, height, minWidth };
}

function svgElement(layout: DotLayout, name: string): string {
  const attrs = [
    ` role="img" aria-label="${name}"`,
    ` style="max-width:${layout.width}px;min-width:${layout.minWidth}px"`,
  ].join("");
  return layout.svg.replace("<svg", `<svg${attrs}`);
}

export function renderDot(gv: GraphvizInstance, code: string, xref: CrossrefMap, currentHref: string, prefix: string): string {
  const { body, label, cap } = extractDirectives(code, "//|");
  const name = escapeAttribute(cap || label || "Diagram");
  let inner: string;
  try {
    inner = svgElement(compile(gv, body), name);
  } catch (e) { inner = `<pre class="rdr-diagram-error">graphviz error: ${String(e)}</pre>`; }
  return figureWrap(`<div class="rdr-diagram">${inner}</div>`, label, cap, xref, currentHref, prefix);
}

export function renderMermaid(code: string, xref: CrossrefMap, currentHref: string, prefix: string): string {
  const { body, label, cap } = extractDirectives(code, "%%|");
  const esc = body.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return figureWrap(`<pre class="mermaid">${esc}</pre>`, label, cap, xref, currentHref, prefix);
}
