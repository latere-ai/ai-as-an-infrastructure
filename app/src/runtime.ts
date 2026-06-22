// After-body runtime scripts shared by the static build (build.ts) and the dev
// server (dev.ts): the viz runtime (viz-runtime.html) and mermaid init.
// Centralized here so the two renderers can't drift, dev.ts once omitted these,
// which silently disabled viz components and mermaid diagrams under `make dev`.
// (The runnable-cell + table runtimes now ship in the client bundle, src/runtime/.)
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MERMAID_INIT = `<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
// The reader calls this after hydration (it owns the article DOM).
window.__rdrMermaid = () => mermaid.run({ querySelector: ".mermaid:not([data-processed='true'])" }).catch(() => {});
if (window.__rdrRuntimesReady) window.__rdrRuntimesReady();
</script>`;

// Viz IIFE (verbatim, framework-free) followed by mermaid init. The runnable-cell
// and table runtimes now ship in the client bundle (src/runtime/), so only viz
// and mermaid remain as injected scripts. Returns the raw <script> blocks to
// inject after <body>.
export function buildAfterBody(repoRoot: string): string {
  const runtime = (f: string) => (existsSync(join(repoRoot, f)) ? readFileSync(join(repoRoot, f), "utf8") : "");
  return runtime("viz-runtime.html") + MERMAID_INIT;
}
