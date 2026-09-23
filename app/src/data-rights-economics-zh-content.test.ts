import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chinese = readFileSync(
  new URL("../../zh/ecosystem/07-data-rights-economics.qmd", import.meta.url),
  "utf8",
);

test("the net-benefit equation uses mobile-safe rows", () => {
  const equation = chinese.match(/NB_H\(D\)[\s\S]*?\\end\{aligned\}/)?.[0] ?? "";
  const rows = equation.split(/\\\\\s*\n/);
  expect(rows.length).toBeGreaterThanOrEqual(7);
  for (const row of rows) expect(row.replace(/\s+/g, " ").length).toBeLessThanOrEqual(52);
});
