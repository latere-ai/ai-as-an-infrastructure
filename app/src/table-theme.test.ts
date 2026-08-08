import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("./theme.css", import.meta.url), "utf8");

test("four-column mobile tables retain readable columns inside their scroller", () => {
  const rule = css.match(
    /\.table-scroll table:has\(tr > :nth-child\(4\)\) \{[^}]*\}/,
  )?.[0] ?? "";

  expect(rule).toContain("min-width: 42rem");
});
