// Diagram rendering. Graphviz (```{dot}```) is rendered to inline SVG at build
// time via @hpcc-js/wasm (no system dependency). Mermaid (```{mermaid}```) is
// emitted as <pre class="mermaid"> and rendered client-side (as Quarto does),
// themed from the palette. Both support Quarto's //| label: / %%| label: and
// fig-cap: directives and become numbered <figure>s via the crossref map.

import { Graphviz } from "@hpcc-js/wasm";
import type { CrossrefMap } from "./crossref.ts";
import { relHref } from "./crossref.ts";

export type GraphvizInstance = Awaited<ReturnType<typeof Graphviz.load>>;

export async function loadGraphviz(): Promise<GraphvizInstance> {
  return await Graphviz.load();
}

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

function figureWrap(inner: string, label: string | undefined, cap: string | undefined, xref: CrossrefMap, currentHref: string): string {
  const id = label ? ` id="${label}"` : "";
  let caption = "";
  if (cap || label) {
    const num = label ? xref.get(label)?.label : "";
    const numPart = num ? `<span class="rdr-fig-num">${num}.</span> ` : "";
    caption = `<figcaption>${numPart}${cap ?? ""}</figcaption>`;
  }
  return `<figure class="rdr-figure"${id}>${inner}${caption}</figure>`;
}

export function renderDot(gv: GraphvizInstance, code: string, xref: CrossrefMap, currentHref: string): string {
  const { body, label, cap } = extractDirectives(code, "//|");
  let svg: string;
  try {
    svg = gv.dot(body, "svg");
    const i = svg.indexOf("<svg"); // drop the <?xml?> + DOCTYPE preamble for inline HTML
    if (i > 0) svg = svg.slice(i);
  } catch (e) { svg = `<pre class="rdr-diagram-error">graphviz error: ${String(e)}</pre>`; }
  return figureWrap(`<div class="rdr-diagram">${svg}</div>`, label, cap, xref, currentHref);
}

export function renderMermaid(code: string, xref: CrossrefMap, currentHref: string): string {
  const { body, label, cap } = extractDirectives(code, "%%|");
  const esc = body.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return figureWrap(`<pre class="mermaid">${esc}</pre>`, label, cap, xref, currentHref);
}

// keep relHref referenced for future intra-page figure links
void relHref;
