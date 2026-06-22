// After-body runtime scripts shared by the static build (build.ts) and the dev
// server (dev.ts): the runnable-cell runtime (live-runtime.html), the viz
// runtime (viz-runtime.html), and mermaid init. Centralized here so the two
// renderers can't drift, dev.ts once omitted these, which silently disabled
// code execution, viz components, and mermaid diagrams under `make dev`.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MERMAID_INIT = `<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
// The reader calls this after hydration (it owns the article DOM).
window.__rdrMermaid = () => mermaid.run({ querySelector: ".mermaid:not([data-processed='true'])" }).catch(() => {});
if (window.__rdrRuntimesReady) window.__rdrRuntimesReady();
</script>`;

// Runnable-cell + viz IIFEs (verbatim, framework-free) followed by mermaid init.
// Returns the raw <script> blocks to inject after <body>.
export function buildAfterBody(repoRoot: string): string {
  const runtime = (f: string) => (existsSync(join(repoRoot, f)) ? readFileSync(join(repoRoot, f), "utf8") : "");
  return runtime("live-runtime.html") + runtime("viz-runtime.html") + MERMAID_INIT;
}
