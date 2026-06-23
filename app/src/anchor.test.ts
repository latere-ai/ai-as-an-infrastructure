import { test, expect } from "bun:test";
import { findAnchor } from "./anchor.ts";

test("finds a unique quote", () => {
  const text = "Compute-optimal training balances parameters and tokens.";
  expect(findAnchor(text, { exact: "parameters and tokens" })).toEqual([34, 55]);
});

test("disambiguates identical quotes by context", () => {
  const text = "the model is large. the model is small.";
  // two occurrences of "the model"; suffix picks the second.
  const got = findAnchor(text, { exact: "the model", prefix: "large. ", suffix: " is small" });
  expect(got).toEqual([20, 29]);
  expect(text.slice(got![0], got![1])).toBe("the model");
});

test("still finds the quote after surrounding prose drifts", () => {
  // The quote is intact but the rest of the paragraph was rewritten.
  const edited = "A brand new sentence appears first. parameters and tokens remain.";
  expect(findAnchor(edited, { exact: "parameters and tokens", prefix: "old context " }))
    .toEqual([36, 57]);
});

test("orphans when the quoted text itself is edited away", () => {
  const edited = "Compute-optimal training balances width and depth.";
  expect(findAnchor(edited, { exact: "parameters and tokens" })).toBeNull();
});

test("empty quote is never anchored", () => {
  expect(findAnchor("anything", { exact: "" })).toBeNull();
});
