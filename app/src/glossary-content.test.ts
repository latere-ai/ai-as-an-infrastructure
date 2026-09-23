import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const repoRoot = join(import.meta.dir, "../..");
const glossary = parse(readFileSync(join(repoRoot, "glossary.yml"), "utf8")) as Record<
  string,
  { def?: { en?: string } }
>;

test("every glossary entry has an English definition", () => {
  const definitions = Object.entries(glossary).map(([key, entry]) => [key, entry.def?.en ?? ""] as const);
  expect(definitions.length).toBeGreaterThan(0);
  expect(definitions.filter(([, definition]) => !definition.trim()).map(([key]) => key)).toEqual([]);
});
