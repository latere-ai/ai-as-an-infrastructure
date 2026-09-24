import { expect, test } from "bun:test";
import { readFileSync, readdirSync } from "node:fs";

function src(p: string) {
  return readFileSync(new URL("../../" + p, import.meta.url), "utf8");
}

function qmdPaths(dir: string): string[] {
  const base = new URL("../../" + dir + "/", import.meta.url);
  const out: string[] = [];
  for (const entry of readdirSync(base, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory()) out.push(...qmdPaths(path));
    else if (entry.name.endsWith(".qmd")) out.push(path);
  }
  return out;
}

test("substantive chapters expose uncertainty and lower-layer constraints", () => {
  const contestedExceptions = new Set([
    "en/orientation/01-whole-stack.qmd",
    "zh/orientation/01-whole-stack.qmd",
  ]);
  const constraintExceptions = new Set([
    "en/orientation/03-borrowed-ideas.qmd",
    "zh/orientation/03-borrowed-ideas.qmd",
  ]);

  for (const lang of ["en", "zh"]) {
    for (const path of qmdPaths(lang)) {
      if (path.endsWith("/index.qmd") || path.endsWith("/summary.qmd")) continue;
      // Back matter carries no argument, so it owes no contested box or
      // constraint arrow.
      if (path.endsWith("references.qmd") || path.endsWith("glossary.qmd")) continue;
      if (path.endsWith("changelog.qmd") || path.endsWith("contribute.qmd")) continue;
      // A monthly state-of-the-field page records dated facts and points to
      // the chapters that argue them, so it carries no argument of its own.
      if (path.includes("/field/")) continue;

      const text = src(path);
      if (!contestedExceptions.has(path)) {
        const contested = lang === "en" ? /^## .*contested/im : /^## .*争议/m;
        expect(text, `${path} should include a contested/open-question section`).toMatch(contested);
      }
      if (!constraintExceptions.has(path)) {
        const constraint = lang === "en" ? /^## .*(constraint arrow|lower-layer constraint)/im : /^## (下层约束|约束如何向上传导|约束如何传导)/m;
        expect(text, `${path} should include a lower-layer constraint section`).toMatch(constraint);
      }
    }
  }
});

test("no chapter carries a mermaid fence", () => {
  // The reader does not render mermaid, so a ```mermaid or ```{mermaid} fence
  // would ship as a code listing instead of a diagram. Diagrams are figure
  // modules (```{figure}) or Graphviz (```{dot}). Same rule as tools/lint.sh.
  const fence = /^[ \t]*(?:```|~~~)[ \t]*\{?\.?mermaid/m;
  const offenders = ["en", "zh"].flatMap(qmdPaths).filter((path) => fence.test(src(path)));
  expect(offenders).toEqual([]);
});
