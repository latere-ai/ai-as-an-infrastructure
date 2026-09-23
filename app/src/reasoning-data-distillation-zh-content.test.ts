import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../zh/reasoning/06-reasoning-data-distillation.qmd", import.meta.url),
  "utf8",
);

test("the record schema fits a narrow reading column", () => {
  const schema = chapter.match(/```yaml\n([\s\S]*?)\n```/)?.[1];
  expect(schema).toBeDefined();
  expect(Math.max(...schema!.split("\n").map((line) => line.length))).toBeLessThanOrEqual(72);
});
