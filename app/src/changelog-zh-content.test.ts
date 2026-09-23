import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chinese = readFileSync(
  new URL("../../zh/changelog.qmd", import.meta.url),
  "utf8",
);

const english = readFileSync(
  new URL("../../en/changelog.qmd", import.meta.url),
  "utf8",
);

function weekSections(source: string): string[] {
  return source.split(/^## /gm).slice(1);
}

test("every dated entry remains a scannable categorized record", () => {
  const englishSections = weekSections(english);
  for (const [index, section] of weekSections(chinese).entries()) {
    const categories = [...section.matchAll(/^\*\*(新增|调整|更正)\*\*$/gm)];
    expect(categories.length).toBeGreaterThanOrEqual(2);
    expect(section).toMatch(/^- /m);
    expect(section.match(/^- /gm)?.length).toBe(
      englishSections[index].match(/^- /gm)?.length,
    );
  }
});
