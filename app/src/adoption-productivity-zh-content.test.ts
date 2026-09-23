import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chinese = readFileSync(
  new URL("../../zh/ecosystem/06-adoption-productivity.qmd", import.meta.url),
  "utf8",
);

// The roi-balance renderer reads data-lang and has no document-language
// fallback, so the Chinese page must declare it.
test("the ROI explorer declares the Chinese runtime language", () => {
  expect(chinese).toContain('data-viz="roi-balance" data-lang="zh"');
});
