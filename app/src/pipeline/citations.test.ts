// The references page itemizes each cited work by its citation label, the same
// "[Author et al. Year]" form the inline @cite renders, so a reader can match an
// in-text citation to its entry at a glance. Only cited works appear, sorted by
// first author then year.

import { test, expect } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadBibliography, renderBibliography, renderCite, type Bibliography, type BibEntry } from "./citations.ts";

const entry = (e: Partial<BibEntry> & { key: string }): BibEntry => ({
  authors: [],
  year: "n.d.",
  title: "",
  raw: {},
  ...e,
});

function bibOf(entries: BibEntry[], cited: string[]): Bibliography {
  return { entries: new Map(entries.map((e) => [e.key, e])), cited: new Set(cited) };
}

test("each entry leads with its bracketed citation label", () => {
  const vaswani = entry({
    key: "vaswani2017",
    authors: ["Vaswani", "Shazeer", "Parmar"],
    year: "2017",
    title: "Attention is all you need",
    publisher: "NeurIPS",
    url: "https://arxiv.org/abs/1706.03762",
  });
  const html = renderBibliography(bibOf([vaswani], ["vaswani2017"]));
  expect(html).toContain('id="ref-vaswani2017"');
  // label matches the inline cite form: 3+ authors → "et al."
  expect(html).toContain('<span class="rdr-ref-key">[Vaswani et al. 2017]</span>');
  expect(html).toContain("Attention is all you need");
  // year lives in the label, not duplicated as a standalone meta token
  expect(html).not.toContain(">2017.<");
});

test("label author form follows the citation rules (1, 2, 3+ authors)", () => {
  const one = entry({ key: "kaplan2020", authors: ["Kaplan"], year: "2020", title: "Scaling" });
  const two = entry({ key: "ba2019", authors: ["Ba", "Frankle"], year: "2019", title: "Lottery" });
  const html = renderBibliography(bibOf([one, two], ["kaplan2020", "ba2019"]));
  expect(html).toContain("[Kaplan 2020]");
  expect(html).toContain("[Ba and Frankle 2019]");
});

test("an edited volume (editor, no author) cites by editor name, not the bibtex key", () => {
  // Regression: @book{beyer2016sre} carries `editor`, not `author`, so the
  // inline cite used to render the bare key ("beyer2016sre 2016").
  const path = join(tmpdir(), `cite-editor-${process.pid}.bib`);
  writeFileSync(path, `@book{beyer2016sre,
  title  = {Site Reliability Engineering},
  editor = {Beyer, Betsy and Jones, Chris and Petoff, Jennifer},
  year   = {2016},
}\n`);
  const bib = loadBibliography(path);
  const cite = renderCite(bib, { keys: ["beyer2016sre"], bare: true });
  expect(cite).toContain(">Beyer et al. (2016)<"); // visible label
  expect(cite).not.toContain(">beyer2016sre"); // the key must not leak into the text
});

test("a multi-word corporate author keeps its whole name, not the last token", () => {
  // Regression: bibtex `{{Google DeepMind}}` parses as a literal name; surname()
  // used to take the last token, citing it as "DeepMind" (and "Face", "AI", …).
  const path = join(tmpdir(), `cite-corp-${process.pid}.bib`);
  writeFileSync(path, `@misc{gdm2024, author = {{Google DeepMind}}, title = {Gemini}, year = {2024}}
@misc{wandb2024, author = {{Weights & Biases}}, title = {W&B}, year = {2024}}\n`);
  const bib = loadBibliography(path);
  expect(renderCite(bib, { keys: ["gdm2024"], bare: true })).toContain(">Google DeepMind (2024)<");
  const refs = renderBibliography({ entries: bib.entries, cited: new Set(["gdm2024", "wandb2024"]) });
  expect(refs).toContain("[Google DeepMind 2024]");
  expect(refs).toContain("[Weights &amp; Biases 2024]");
});

test("only cited works appear", () => {
  const a = entry({ key: "a2020", authors: ["A"], year: "2020", title: "A" });
  const b = entry({ key: "b2021", authors: ["B"], year: "2021", title: "B" });
  const html = renderBibliography(bibOf([a, b], ["a2020"]));
  expect(html).toContain("[A 2020]");
  expect(html).not.toContain("[B 2021]");
});
