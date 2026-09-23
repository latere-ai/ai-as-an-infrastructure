import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const changelog = readFileSync(
  new URL("../../en/changelog.qmd", import.meta.url),
  "utf8",
);

function weekSections(): string[] {
  return changelog.split(/^## /gm).slice(1);
}

test("every dated entry remains a scannable categorized record", () => {
  for (const section of weekSections()) {
    const categories = [...section.matchAll(/^\*\*(New|Changed|Corrected)\*\*$/gm)];
    expect(categories.length).toBeGreaterThanOrEqual(2);
    expect(section).toMatch(/^- /m);
  }
});
