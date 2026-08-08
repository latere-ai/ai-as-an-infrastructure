// The references page itemizes each cited work by its citation label, the same
// "[Author et al. Year]" form the inline @cite renders, so a reader can match an
// in-text citation to its entry at a glance. Only cited works appear, sorted by
// first author then year.

import { test, expect } from "bun:test";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync } from "node:fs";
import { loadBibliography, loadBibliographyDir, renderBibliography, renderCite, type Bibliography, type BibEntry } from "./citations.ts";

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

test("renders the tldr sentence, language-picked with zh→en fallback", () => {
  const withZh = entry({
    key: "kaplan2020", authors: ["Kaplan"], year: "2020", title: "Scaling",
    tldr: "Establishes power-law scaling of loss in compute.",
    tldrZh: "确立了损失随算力的幂律扩展。",
  });
  const enOnly = entry({
    key: "hoffmann2022", authors: ["Hoffmann"], year: "2022", title: "Chinchilla",
    tldr: "Shows ~20 tokens per parameter is compute-optimal.",
  });
  const bib = bibOf([withZh, enOnly], ["kaplan2020", "hoffmann2022"]);

  const en = renderBibliography(bib, "en");
  expect(en).toContain('<div class="rdr-ref-tldr">Establishes power-law scaling of loss in compute.</div>');
  expect(en).toContain("Shows ~20 tokens per parameter is compute-optimal.");

  const zh = renderBibliography(bib, "zh");
  expect(zh).toContain("确立了损失随算力的幂律扩展。"); // zh tldr
  expect(zh).toContain("Shows ~20 tokens per parameter is compute-optimal."); // falls back to en
});

test("a tldr survives the merge when the same key recurs without one later", () => {
  // Regression: the same work is defined in several chapter bibs; loadBibliographyDir
  // merges them "last wins" by filename, which used to drop a tldr when a
  // later-sorting bib lacked it. The tldr must carry forward across files.
  const dir = mkdtempSync(join(tmpdir(), "cite-merge-"));
  writeFileSync(join(dir, "a-has-tldr.bib"), `@article{dup2020,
  title = {Dup}, author = {A, B}, year = {2020},
  tldr  = {The summary that must survive.},
}\n`);
  writeFileSync(join(dir, "z-no-tldr.bib"), `@article{dup2020,
  title = {Dup}, author = {A, B}, year = {2020},
}\n`); // sorts AFTER a-has-tldr.bib, so it wins the bibliographic fields
  const bib = loadBibliographyDir(dir);
  bib.cited.add("dup2020");
  expect(renderBibliography(bib, "en")).toContain("The summary that must survive.");
});

test("citation aliases for one URL render one source while preserving every fragment", () => {
  const first = entry({
    key: "paper2024",
    authors: ["Author"],
    year: "2024",
    title: "One paper",
    url: "https://example.com/paper/",
  });
  const alias = entry({
    key: "author2024paper",
    authors: ["Author"],
    year: "2024",
    title: "One paper",
    url: "https://example.com/paper",
  });

  const html = renderBibliography(bibOf([first, alias], [first.key, alias.key]));
  expect(html.match(/class="rdr-ref"/g)?.length).toBe(1);
  expect(html).toContain('id="ref-paper2024"');
  expect(html).toContain('id="ref-author2024paper"');
});

test("an entry without a tldr renders no tldr block", () => {
  const e = entry({ key: "x2020", authors: ["X"], year: "2020", title: "X" });
  expect(renderBibliography(bibOf([e], ["x2020"]))).not.toContain("rdr-ref-tldr");
});

test("only cited works appear", () => {
  const a = entry({ key: "a2020", authors: ["A"], year: "2020", title: "A" });
  const b = entry({ key: "b2021", authors: ["B"], year: "2021", title: "B" });
  const html = renderBibliography(bibOf([a, b], ["a2020"]));
  expect(html).toContain("[A 2020]");
  expect(html).not.toContain("[B 2021]");
});
