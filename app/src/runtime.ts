// After-body mermaid init, shared by the static build (build.ts) and the dev
// server (dev.ts). Centralized so the two renderers can't drift; dev.ts once
// omitted this, which silently disabled mermaid diagrams under `make dev`.
// (The runnable-cell, table, and viz runtimes now ship in the client bundle,
// src/runtime/; only mermaid remains an injected <script> because it pulls an
// ESM module from a CDN.)

// Raw <script> block to inject after <body>: initialize mermaid and expose the
// render hook the reader calls after hydration (it owns the article DOM).
export const afterBody = `<script type="module">
import mermaid from "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs";
mermaid.initialize({ startOnLoad: false, theme: "neutral", securityLevel: "loose" });
window.__rdrMermaid = () => mermaid.run({ querySelector: ".mermaid:not([data-processed='true'])" }).catch(() => {});
if (window.__rdrRuntimesReady) window.__rdrRuntimesReady();
</script>`;
