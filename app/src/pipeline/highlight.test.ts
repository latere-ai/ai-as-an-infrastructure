// The one correctness trap in build-time highlighting is escaping: a technical
// book's code is full of literal <, >, & (generics, comparisons, bit ops). A
// leaked raw < breaks the page. Identifiers/keywords are \w-only so they emit
// raw; everything else must be escaped.

import { test, expect } from "bun:test";
import { highlightPy, highlightCode } from "./highlight.ts";

test("literal <, >, & in code are escaped, never emitted raw", () => {
  const out = highlightPy("x < y and z > w  # a & b");
  expect(out).toContain("&lt;");
  expect(out).toContain("&gt;");
  expect(out).toContain("&amp;");
  // no raw angle bracket may survive except the ones opening our own <span> tags
  expect(out.replace(/<\/?span[^>]*>/g, "")).not.toContain("<");
  expect(out.replace(/<\/?span[^>]*>/g, "")).not.toContain(">");
});

test("keywords, builtins, strings, comments, numbers get their token classes", () => {
  const out = highlightPy('def f():\n    return len("hi")  # 42 done\n    n = 3.14');
  expect(out).toContain('<span class="lt-kw">def</span>');
  expect(out).toContain('<span class="lt-kw">return</span>');
  expect(out).toContain('<span class="lt-bi">len</span>');
  expect(out).toContain('<span class="lt-str">"hi"</span>');
  expect(out).toContain('<span class="lt-com">');
  expect(out).toContain('<span class="lt-num">3.14</span>');
});

test("a keyword inside a string or comment stays plain (matched first)", () => {
  expect(highlightPy('"def not a keyword"')).toBe('<span class="lt-str">"def not a keyword"</span>');
  const com = highlightPy("# return is just a comment");
  expect(com).not.toContain('lt-kw');
});

test("highlightCode only handles python; other langs return '' for default escaping", () => {
  expect(highlightCode("a: b", "yaml")).toBe("");
  expect(highlightCode("echo hi", "bash")).toBe("");
  expect(highlightCode("x=1", "python")).not.toBe("");
});
