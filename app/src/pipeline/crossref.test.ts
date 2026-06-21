// Regression test: cross-refs that ride inside a figure caption or a Further-
// reading gloss bypass the markdown-it inline rule, so they used to render as
// literal "@sec-..." text (seen in ch14's refs note and ch45's fig-cap). The
// resolveXrefsInText helper resolves them the same way the inline rule does.

import { test, expect } from "bun:test";
import { resolveXrefsInText, type CrossrefMap } from "./crossref.ts";

const xref: CrossrefMap = new Map([
  ["sec-rlhf", { kind: "sec", label: "Chapter 10", href: "p2-adaptation/10-rlhf-reward-modeling.html#sec-rlhf" }],
]);

test("resolves a known @sec ref inside a caption/gloss to a chapter link", () => {
  const out = resolveXrefsInText("introduced in @sec-rlhf, reused here", xref, "p3-reasoning/14-x.html", "../");
  expect(out).toContain('<a href="../p2-adaptation/10-rlhf-reward-modeling.html#sec-rlhf" class="rdr-xref">Chapter 10</a>');
  expect(out).toContain("introduced in ");
  expect(out).toContain(", reused here");
  expect(out).not.toContain("@sec-rlhf");
});

test("does not fire when @ is preceded by an alphanumeric (email-like)", () => {
  const out = resolveXrefsInText("mail user@sec-rlhf stays", xref, "x.html", "");
  expect(out).toContain("user@sec-rlhf");
});

test("unknown ref renders the missing marker, not literal text", () => {
  const out = resolveXrefsInText("see @sec-nope here", xref, "x.html", "");
  expect(out).toContain('rdr-xref-missing">?@sec-nope');
  expect(out).not.toContain(" @sec-nope ");
});

test("a same-page ref uses a bare anchor (no prefix)", () => {
  const out = resolveXrefsInText("see @sec-rlhf", xref, "p2-adaptation/10-rlhf-reward-modeling.html", "../");
  expect(out).toContain('href="#sec-rlhf"');
});

test("leaves non-ref text and bare citation keys untouched", () => {
  const out = resolveXrefsInText("cite @smith2020 and plain text", xref, "x.html", "");
  expect(out).toBe("cite @smith2020 and plain text");
});
