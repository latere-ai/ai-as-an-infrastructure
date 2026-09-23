import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/orchestration/06-computer-use.qmd", import.meta.url),
  "utf8",
);

test("the action contract fits a narrow reading column", () => {
  const contract = chapter.match(/```text\n([\s\S]*?)\n```/)?.[1];
  expect(contract).toBeDefined();
  expect(Math.max(...contract!.split("\n").map((line) => line.length))).toBeLessThanOrEqual(32);
});
