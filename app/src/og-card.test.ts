import { expect, test } from "bun:test";
import { cardHtml, chapterCard, type CardChapter } from "./og-card.ts";
import { selectCards } from "./og-select.ts";

const ch = (c: Partial<CardChapter>): CardChapter => ({ partLabel: "", num: "", title: "", role: "chapter", ...c });
const PART = "Part IX: Infrastructure and Compute";

test("a numbered chapter card carries its part, number and title", () => {
  const card = chapterCard(ch({ partLabel: PART, num: "67", title: "Making the Silicon" }), "en", "Book", "Author");
  expect(card.label).toBe("Part IX · Chapter 67");
  expect(card.title).toBe("Making the Silicon");
});

test("a part's opening page and its summary are titled with the part", () => {
  const intro = chapterCard(ch({ partLabel: PART, title: PART, role: "part" }), "en", "Book", "Author");
  const summary = chapterCard(ch({ partLabel: PART, title: "Summary" }), "en", "Book", "Author");
  expect(intro).toMatchObject({ label: "Part IX", title: "Infrastructure and Compute" });
  expect(summary).toMatchObject({ label: "Part IX · Summary", title: "Infrastructure and Compute" });
});

test("a page outside the parts is labeled with the book", () => {
  expect(chapterCard(ch({ title: "Glossary" }), "en", "Book", "Author")).toMatchObject({ label: "Book", title: "Glossary" });
});

test("zh chapter cards take the zh part and chapter forms", () => {
  const card = chapterCard(ch({ partLabel: "第九部分 · 基础设施与算力", num: "67", title: "制造芯片" }), "zh", "书", "作者");
  expect(card.label).toBe("第九部分 · 第 67 章");
});

test("cards render in the ink palette without gradients, with text escaped", () => {
  const chapter = cardHtml({ kind: "chapter", label: "Part I", title: "A <b> & C", author: "Author" }, "en", "", "");
  const home = cardHtml({ kind: "home", title: "Book Title", subtitle: "The subtitle", author: "Author" }, "en", "", "<div class=\"cv\"></div>");
  for (const html of [chapter, home]) {
    expect(html).toContain('data-palette="ink"');
    expect(html).toContain('data-theme="light"');
    expect(html).not.toMatch(/gradient\(/);
  }
  expect(chapter).toContain("A &lt;b&gt; &amp; C");
  expect(home).toContain('<div class="cv"></div>');
  expect(home).toContain("The subtitle");
  expect(cardHtml({ kind: "chapter", label: "", title: "", author: "" }, "zh", "", "")).toContain('lang="zh-Hans"');
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
