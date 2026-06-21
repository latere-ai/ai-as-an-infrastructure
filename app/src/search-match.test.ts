// The client matcher: multi-word AND, ranking, per-chapter cap, snippet.

import { test, expect } from "bun:test";
import { runSearch, snippet, fuzzyScore, type SearchDoc } from "./search-match.ts";

const doc = (p: Partial<SearchDoc>): SearchDoc => ({
  href: "ch", anchor: "", num: "1", title: "", heading: "", text: "", ...p,
});

test("exact substring matches case-insensitively across fields", () => {
  const docs = [doc({ href: "a", title: "Scaling Laws", text: "the loss follows a power law" })];
  expect(runSearch(docs, "scaling").length).toBe(1);
  expect(runSearch(docs, "POWER LAW").length).toBe(1);
  expect(runSearch(docs, "diffusion").length).toBe(0);
});

test("multi-word query requires every token (AND), order-independent", () => {
  const both = doc({ href: "a", title: "Transformer attention", text: "self-attention in the transformer" });
  const one = doc({ href: "b", title: "Transformer blocks", text: "residual streams" });
  const docs = [both, one];
  // both tokens present -> only the doc that has both
  expect(runSearch(docs, "transformer attention").map((r) => r.doc.href)).toEqual(["a"]);
  // reordered tokens still match (not adjacency-based)
  expect(runSearch(docs, "attention transformer").map((r) => r.doc.href)).toEqual(["a"]);
  // a token nobody has -> nothing
  expect(runSearch(docs, "transformer diffusion").length).toBe(0);
});

test("a pure-hanzi query stays one token and matches by substring", () => {
  const docs = [doc({ href: "z", title: "奖励建模", text: "奖励欺骗是核心失效" })];
  expect(runSearch(docs, "奖励欺骗").length).toBe(1);
  expect(runSearch(docs, "奖励黑客").length).toBe(0);
});

test("title hits outrank body-only hits", () => {
  const inTitle = doc({ href: "a", title: "Reward hacking", text: "unrelated body" });
  const inBody = doc({ href: "b", title: "Some chapter", text: "a note on reward hacking here" });
  const ranked = runSearch([inBody, inTitle], "reward hacking").map((r) => r.doc.href);
  expect(ranked[0]).toBe("a");
});

test("more exact-token hits rank above fewer", () => {
  const twoTok = doc({ href: "a", title: "alpha beta", text: "x" });
  const oneTok = doc({ href: "b", title: "alpha only", text: "x" });
  const ranked = runSearch([oneTok, twoTok], "alpha beta").map((r) => r.doc.href);
  expect(ranked[0]).toBe("a");
});

test("caps sections per chapter at 2 and total at the limit", () => {
  const many = Array.from({ length: 5 }, (_, i) =>
    doc({ href: "same", anchor: `s${i}`, heading: `Section ${i}`, text: "shared keyword here" }));
  const res = runSearch(many, "keyword");
  expect(res.length).toBe(2); // per-chapter cap
  const wide = Array.from({ length: 20 }, (_, i) => doc({ href: `c${i}`, text: "keyword" }));
  expect(runSearch(wide, "keyword", 12).length).toBe(12); // total limit
});

test("snippet centres on the token and marks the hit, preserving original case", () => {
  const s = snippet("The Reward signal is learned.", "reward");
  expect(s.hit).toBe("Reward"); // original case kept
  expect((s.pre + s.hit + s.post).includes("Reward")).toBe(true);
});

test("fuzzy: a typo with a dropped/extra letter still matches via the title", () => {
  const docs = [doc({ href: "a", title: "Transformer attention", text: "self-attention" })];
  expect(runSearch(docs, "transfomer").length).toBe(1); // dropped 'r'
  expect(runSearch(docs, "atention").length).toBe(1); // dropped 't'
  // a token that is not even a subsequence of any short field matches nothing
  expect(runSearch(docs, "zzzz").length).toBe(0);
});

test("fuzzy never displaces an exact match", () => {
  const exact = doc({ href: "exact", title: "Transformer" });
  const fuzzy = doc({ href: "fuzzy", title: "Transfomer architecture is great" });
  const ranked = runSearch([fuzzy, exact], "transformer").map((r) => r.doc.href);
  expect(ranked[0]).toBe("exact");
});

test("fuzzyScore: subsequence with bonuses, 0 when not a subsequence or too loose", () => {
  expect(fuzzyScore("abc", "abc")).toBeGreaterThan(0);
  expect(fuzzyScore("abc", "axbxc")).toBeGreaterThan(0); // subsequence with gaps
  expect(fuzzyScore("abc", "acb")).toBe(0); // transposition: not in-order
  expect(fuzzyScore("a", "abc")).toBe(0); // single char too short for fuzzy
  expect(fuzzyScore("abc", "a-very-long-string-b-then-c")).toBe(0); // scattered: rejected
});

test("empty / whitespace query yields nothing", () => {
  const docs = [doc({ text: "anything" })];
  expect(runSearch(docs, "").length).toBe(0);
  expect(runSearch(docs, "   ").length).toBe(0);
});
