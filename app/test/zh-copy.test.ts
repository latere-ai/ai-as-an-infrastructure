import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";

const zhRoot = join(import.meta.dir, "..", "..", "zh");
const deprecatedLabel = "约束" + "箭头";

function qmdFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...qmdFiles(path));
    else if (entry.name.endsWith(".qmd")) out.push(path);
  }
  return out;
}

test("zh source uses 下层约束 instead of the calqued old label", () => {
  const offenders = qmdFiles(zhRoot).filter((path) =>
    readFileSync(path, "utf8").includes(deprecatedLabel),
  );
  expect(offenders.map((path) => path.replace(zhRoot + "/", ""))).toEqual([]);
});
