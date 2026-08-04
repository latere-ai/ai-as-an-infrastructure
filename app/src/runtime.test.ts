import { expect, test } from "bun:test";
import { afterBody } from "./runtime.ts";
import { readFileSync } from "node:fs";

const live = readFileSync(new URL("./runtime/live.ts", import.meta.url), "utf8");

// Only mermaid remains an injected after-body script (it pulls an ESM module
// from a CDN). The runnable-cell, table, and viz runtimes ship in the client
// bundle instead, so they must NOT also be injected here.
test("afterBody injects only the mermaid runtime", () => {
  expect(afterBody).toContain("__rdrMermaid");
  expect(afterBody).not.toContain("__rdrLive");
  expect(afterBody).not.toContain("__rdrViz");
});

// Regression: the runnable-cell, table, and viz runtimes were relocated from
// root HTML files into src/runtime/ and registered by hydrate.tsx. Build the
// client bundle the way build.ts does and assert they actually ship in it.
test("client bundle includes the relocated runtimes", async () => {
  const out = await Bun.build({
    entrypoints: [new URL("./hydrate.tsx", import.meta.url).pathname],
    target: "browser",
    define: { "process.env.NODE_ENV": '"production"' },
  });
  expect(out.success).toBeTrue();
  const js = await out.outputs[0].text();
  expect(js).toContain("__rdrTables"); // table-wrap runtime
  expect(js).toContain("__rdrLive"); // runnable-cell runtime
  expect(js).toContain("__rdrViz"); // viz runtime
});

test("runnable editors and results expose localized accessible names and updates", () => {
  expect(live).toContain("document.documentElement.lang");
  expect(live).toContain("Runnable Python code");
  expect(live).toContain("可运行的 Python 代码");
  expect(live).toContain("run: zh ? '运行' : 'Run'");
  expect(live).toContain("reset: zh ? '重置' : 'Reset'");
  expect(live).toMatch(/status\.setAttribute\('role', 'status'\)/);
  expect(live).toMatch(/status\.setAttribute\('aria-live', 'polite'\)/);
  expect(live).toMatch(/out\.setAttribute\('aria-live', 'polite'\)/);
});

test("Escape releases Tab from the runnable code editor", () => {
  expect(live).toContain("e.key === 'Escape'");
  expect(live).toContain("releaseTab = true");
  expect(live).toMatch(/if \(releaseTab\) \{ releaseTab = false; return; \}/);
  expect(live).toContain("Press Escape, then Tab, to leave the editor");
});
