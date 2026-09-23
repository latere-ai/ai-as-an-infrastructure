// Regression test: the href strips the authoring ordinal from a chapter file
// ("01-scaling-laws" -> "scaling-laws"). It used to strip any leading digits,
// so the dated page "field/2026-09.qmd" published at "field/09", and every
// September edition would have shared that one URL.

import { test, expect } from "bun:test";
import { qmdToHref } from "./book.ts";

test("a chapter's two-digit ordinal is stripped from its href", () => {
  expect(qmdToHref("foundations/01-scaling-laws.qmd")).toBe("foundations/scaling-laws");
  expect(qmdToHref("practice/13-operating-contracts.qmd")).toBe("practice/operating-contracts");
  expect(qmdToHref("foundations/index.qmd")).toBe("foundations");
  expect(qmdToHref("summary.qmd")).toBe("summary");
});

test("a dated page keeps its year and month in its href", () => {
  expect(qmdToHref("field/2026-09.qmd")).toBe("field/2026-09");
  expect(qmdToHref("field/2027-09.qmd")).not.toBe(qmdToHref("field/2026-09.qmd"));
});
