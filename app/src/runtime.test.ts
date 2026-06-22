import { expect, test } from "bun:test";
import { buildAfterBody } from "./runtime.ts";

const repoRoot = new URL("../../", import.meta.url).pathname;

// Regression: the dev server omitted the after-body runtime, so code execution,
// viz, and mermaid diagrams silently did nothing under `make dev`. The shared
// builder must emit all three so the static build and dev server stay in sync.
test("buildAfterBody wires the runnable, viz, and mermaid runtimes", () => {
  const afterBody = buildAfterBody(repoRoot);
  expect(afterBody).toContain("__rdrLive"); // runnable-cell runtime
  expect(afterBody).toContain("__rdrViz"); // viz runtime
  expect(afterBody).toContain("__rdrMermaid"); // mermaid init
});
