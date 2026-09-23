import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chinese = readFileSync(
  new URL("../../zh/practice/05-agents-and-sandboxes.qmd", import.meta.url),
  "utf8",
);

test("display equations use mobile-safe rows", () => {
  for (const block of chinese.matchAll(/^\$\$\n([\s\S]*?)\n\$\$$/gm)) {
    for (const line of block[1].split("\n")) expect(line.length).toBeLessThanOrEqual(68);
  }
});
