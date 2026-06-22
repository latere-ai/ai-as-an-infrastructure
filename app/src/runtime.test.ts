import { expect, test } from "bun:test";
import { buildAfterBody } from "./runtime.ts";

const repoRoot = new URL("../../", import.meta.url).pathname;

// The injected after-body scripts carry the viz runtime and mermaid init. The
// runnable-cell and table runtimes now ship in the client bundle instead (see
// the bundle test below), so they must NOT also be injected here.
test("buildAfterBody injects the viz and mermaid runtimes", () => {
  const afterBody = buildAfterBody(repoRoot);
  expect(afterBody).toContain("__rdrViz"); // viz runtime
  expect(afterBody).toContain("__rdrMermaid"); // mermaid init
  expect(afterBody).not.toContain("__rdrLive"); // runnable cells moved to the bundle
});

// Regression: the runnable-cell and table runtimes were relocated from root HTML
// files into src/runtime/ and registered by hydrate.tsx. Build the client bundle
// the way build.ts does and assert they actually ship in it.
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
});
