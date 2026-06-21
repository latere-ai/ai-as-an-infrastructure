// Regression: a bare in-text citation @key at the start of a paragraph used to
// render its href without the page-relative prefix ("references#ref-x" instead
// of "../references#ref-x"), so the link 404'd from any chaptered page. The
// bracketed form [@key] threaded ctx.prefix; the bare form dropped it.

import { test, expect } from "bun:test";
import MarkdownIt from "markdown-it";
import { quartoRefs } from "./quarto-refs.ts";
import type { Bibliography } from "./citations.ts";
import type { CrossrefMap } from "./crossref.ts";

function bibOf(key: string): Bibliography {
  return {
    entries: new Map([[key, { key, authors: ["Smith"], year: "2020", title: "T", raw: {} }]]),
    cited: new Set<string>(),
  };
}

function render(srcText: string, prefix: string): string {
  const md = new MarkdownIt();
  const ctx = { bib: bibOf("smith2020"), xref: new Map() as CrossrefMap, currentHref: "p1-x/y.html", prefix };
  md.use(quartoRefs, ctx);
  return md.render(srcText);
}

test("bare @key citation threads the page-relative prefix into the href", () => {
  const out = render("@smith2020 says so.", "../");
  expect(out).toContain('href="../references#ref-smith2020"');
  expect(out).not.toContain('href="references#ref-smith2020"');
});

test("bracketed [@key] citation also carries the prefix", () => {
  const out = render("as shown [@smith2020].", "../");
  expect(out).toContain('href="../references#ref-smith2020"');
});

test("an empty prefix (page at root depth) emits a bare references href", () => {
  const out = render("@smith2020 again.", "");
  expect(out).toContain('href="references#ref-smith2020"');
});
