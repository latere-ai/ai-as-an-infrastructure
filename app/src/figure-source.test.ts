import { expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const figuresSrc = join(repoRoot, "figures-src");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const sourceScripts = readdirSync(figuresSrc)
  .filter((file) => file.endsWith(".py"))
  .filter((file) => !["common.py", "figure_catalog.py"].includes(file));

test("figure source scripts use stable number-free names and output paths", () => {
  for (const script of sourceScripts) {
    expect(script).not.toMatch(/^\d+-/);
    const text = readFileSync(join(figuresSrc, script), "utf8");
    expect(text).not.toMatch(/\/figures\/\d+-/);
    expect(text).not.toContain("/Users/");
  }
});

test("every committed static SVG figure has source and bilingual outputs", () => {
  const sources = new Set(sourceScripts.map((file) => basename(file, ".py")));
  const refs = new Set<string>();

  for (const lang of ["en", "zh"]) {
    for (const file of walk(join(repoRoot, lang)).filter((path) => path.endsWith(".qmd"))) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(/\/figures\/([^)\s]+\.svg)/g)) {
        refs.add(match[1].replace(/\.svg$/, ""));
      }
    }
  }

  expect(refs.size).toBeGreaterThan(0);
  for (const ref of refs) {
    expect(sources.has(ref), `${ref} needs figures-src/${ref}.py`).toBe(true);
  }

  for (const source of sources) {
    expect(existsSync(join(repoRoot, "en", "figures", `${source}.svg`)), `${source} missing en SVG`).toBe(true);
    expect(existsSync(join(repoRoot, "zh", "figures", `${source}.svg`)), `${source} missing zh SVG`).toBe(true);
  }
});
