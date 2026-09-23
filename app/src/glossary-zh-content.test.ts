import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";

const repoRoot = join(import.meta.dir, "../..");
const source = readFileSync(join(repoRoot, "zh/glossary.qmd"), "utf8");
const glossary = parse(readFileSync(join(repoRoot, "glossary.yml"), "utf8")) as Record<
  string,
  {
    en?: string;
    zh?: string;
    def?: { en?: string; zh?: string };
  }
>;
const definitions = Object.entries(glossary).map(([key, entry]) => ({
  key,
  en: entry.def?.en ?? "",
  zh: entry.def?.zh ?? "",
}));

test("the Chinese glossary page carries the generated glossary slot", () => {
  expect(source).toContain("::: {#glossary}\n:::");
});

test("every English glossary entry has a complete Chinese counterpart", () => {
  expect(definitions.length).toBeGreaterThan(150);
  expect(
    Object.entries(glossary)
      .filter(([, entry]) => !entry.en || !entry.zh || !entry.def?.en || !entry.def?.zh)
      .map(([key]) => key),
  ).toEqual([]);
});

test("Chinese definitions end with a full stop and use no em dash", () => {
  expect(definitions.filter(({ zh }) => !zh.endsWith("。")).map(({ key }) => key)).toEqual([]);
  expect(definitions.filter(({ zh }) => zh.includes("—")).map(({ key }) => key)).toEqual([]);
});
