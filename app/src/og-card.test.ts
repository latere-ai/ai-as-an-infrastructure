import { readFileSync } from "node:fs";
import { expect, test } from "bun:test";
import { SITE_CARD_EYEBROW, SITE_DESCRIPTION } from "./site.ts";
import { selectCards } from "./og-select.ts";

const source = readFileSync(new URL("./og.ts", import.meta.url), "utf8");

test("home share card uses reader-facing book copy", () => {
  expect(SITE_CARD_EYEBROW).toBe("A design driven technical book");
  expect(SITE_DESCRIPTION).toContain("lifecycle of a capability");
  expect(source).toContain("SITE_CARD_EYEBROW");
  expect(source).toContain("SITE_DESCRIPTION");
  expect(source).not.toContain("A bilingual technical book");
});

test("share card footer does not print a subtitle under the author", () => {
  expect(source).toContain('<div class="author">${esc(AUTHOR)}</div>');
  expect(source).not.toContain('class="kind"');
  expect(source).not.toContain("design-first technical book");
});

test("no arguments draws every card, an href draws only that one", () => {
  const book = [{ href: "index" }, { href: "contribute" }, { href: "foundations/tokenization" }];

  expect(selectCards(book, []).wanted).toEqual(book);
  expect(selectCards(book, ["contribute"]).wanted).toEqual([{ href: "contribute" }]);
  expect(selectCards(book, []).unknown).toEqual([]);
});

test("a misspelled href is reported rather than silently drawing nothing", () => {
  const book = [{ href: "contribute" }];
  const { wanted, unknown } = selectCards(book, ["contribute", "contributing"]);

  expect(wanted).toEqual([{ href: "contribute" }]);
  expect(unknown).toEqual(["contributing"]);
});
