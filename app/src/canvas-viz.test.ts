// Contract for the older canvas components in runtime/viz.ts, which figure
// modules (app/src/figures) replace chapter by chapter. Every component a
// chapter embeds must be registered, and every registered component must still
// be embedded somewhere, so a component is deleted together with its last use.

import { test, expect } from "bun:test";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const rt = readFileSync(new URL("./runtime/viz.ts", import.meta.url), "utf8");
const repoRoot = join(import.meta.dir, "..", "..");
const registered = new Set([...rt.matchAll(/R\['([a-z0-9-]+)'\]\s*=\s*function/g)].map((m) => m[1]));

function qmdFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true, recursive: true })
    .filter((e) => e.isFile() && e.name.endsWith(".qmd"))
    .map((e) => join(e.parentPath, e.name));
}

const embedded = new Map<string, string[]>();
for (const lang of ["en", "zh"]) {
  for (const file of qmdFiles(join(repoRoot, lang))) {
    for (const m of readFileSync(file, "utf8").matchAll(/data-viz="([a-z0-9-]+)"/g)) {
      embedded.set(m[1], [...(embedded.get(m[1]) ?? []), file.slice(repoRoot.length + 1)]);
    }
  }
}

test("every canvas component a chapter embeds is registered", () => {
  const missing = [...embedded.keys()].filter((name) => !registered.has(name));
  expect(missing).toEqual([]);
});

test("every registered canvas component is still embedded in a chapter", () => {
  const unused = [...registered].filter((name) => !embedded.has(name));
  expect(unused).toEqual([]);
});
