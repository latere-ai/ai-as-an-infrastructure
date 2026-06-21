// splitSections turns a compiled chapter body into per-section search docs so a
// match can deep-link to its <h2/h3 id> anchor and the box can show a snippet.

import { test, expect } from "bun:test";
import { splitSections, buildSearchDocs } from "./search.ts";
import type { ChapterData } from "../types.ts";

const chapter = (title: string, html: string): ChapterData =>
  ({ title, chapterNum: "10", contentHtml: html } as unknown as ChapterData);

test("intro text before the first heading becomes an anchorless section", () => {
  const html = [
    "<p>An opening paragraph with no heading above it.</p>",
    '<h2 id="design">Design</h2>',
    "<p>Body of the design section.</p>",
  ].join("");

  const secs = splitSections(html);
  expect(secs.length).toBe(2);
  expect(secs[0]).toEqual({ anchor: "", heading: "", text: "An opening paragraph with no heading above it." });
  expect(secs[1].anchor).toBe("design");
  expect(secs[1].heading).toBe("Design");
  expect(secs[1].text).toBe("Body of the design section.");
});

test("each h2/h3 boundary starts a new section that stops at the next heading", () => {
  const html = [
    '<h2 id="a">First</h2>',
    "<p>alpha</p>",
    '<h3 id="a-sub">First sub</h3>',
    "<p>beta</p>",
    '<h2 id="b">Second</h2>',
    "<p>gamma</p>",
  ].join("");

  const secs = splitSections(html);
  expect(secs.map((s) => s.anchor)).toEqual(["a", "a-sub", "b"]);
  expect(secs.map((s) => s.text)).toEqual(["alpha", "beta", "gamma"]);
  // an h2 with an h3 under it stops at the h3 (deep-link to the nearest heading).
  expect(secs[0].text).toBe("alpha");
});

test("section text keeps literal code characters and drops markup", () => {
  const html = [
    '<h2 id="types">Types</h2>',
    "<p>Use <code>ReturnType&lt;typeof f&gt;</code> here.</p>",
  ].join("");

  const secs = splitSections(html);
  expect(secs[0].text).toContain("ReturnType");
  expect(secs[0].text).not.toContain("<code>");
});

test("headings without an id are not section boundaries", () => {
  const html = '<h2>No anchor</h2><p>still intro</p>';
  const secs = splitSections(html);
  expect(secs.length).toBe(1);
  expect(secs[0].anchor).toBe("");
});

test("zh docs carry a pinyin index over title+heading; en docs do not", () => {
  const html = '<h2 id="a">奖励欺骗</h2><p>正文</p>';
  const zh = buildSearchDocs(chapter("奖励建模", html), "ch", "zh");
  const sec = zh.find((d) => d.anchor === "a")!;
  // full pinyin of title+heading lets a Latin query reach the Han content
  expect(sec.py).toContain("jiangli"); // 奖励 -> jiangli
  expect(sec.py).toContain("qipian"); // 欺骗 -> qipian (from the heading)
  expect(sec.pyi).toContain("jl"); // initials
  // the same chapter built as en gets no pinyin fields
  const en = buildSearchDocs(chapter("Reward modeling", '<h2 id="a">Reward hacking</h2><p>body</p>'), "ch", "en");
  expect(en.find((d) => d.anchor === "a")!.py).toBeUndefined();
});
