import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";

const bookRoot = join(import.meta.dir, "..", "..", "_book");

test("generated preface output does not expose internal authoring-convention copy", () => {
  const generated = [
    join(bookRoot, "en", "index.html"),
    join(bookRoot, "en", "search.json"),
    join(bookRoot, "zh", "index.html"),
    join(bookRoot, "zh", "search.json"),
  ];

  for (const path of generated) {
    const text = readFileSync(path, "utf8");
    expect(text).not.toContain("CONVENTIONS.md");
    expect(text).not.toContain("authoring conventions are recorded");
    expect(text).not.toContain("具体的写作约定记在项目的");
  }
});
