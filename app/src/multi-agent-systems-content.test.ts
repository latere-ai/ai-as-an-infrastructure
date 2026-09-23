import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/orchestration/07-multi-agent-systems.qmd", import.meta.url),
  "utf8",
);

test("the majority-error equation is split for a narrow reading column", () => {
  const majority = chapter.match(/\\begin\{gathered\}[\s\S]*?\\end\{gathered\}/)?.[0];
  expect(majority).toBeDefined();
  expect(majority!.split("\n").length).toBeGreaterThan(4);
});
