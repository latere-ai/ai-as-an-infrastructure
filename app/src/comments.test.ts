// Regression test for the "reader breaks with F.reduce is not a function" bug.
//
// GET /api/comments returned a 500 (transient DB blip) with a JSON error body
// {"error":"list failed"}. api.list used jsonOrNull, which parsed that object
// and returned it as-is; setList stored a non-array, and countAll's `.reduce`
// then threw "F.reduce is not a function", crashing the entire reader. The fix
// makes the list fetchers always resolve to an array and guards countAll.

import { test, expect } from "bun:test";
import { countAll, type Comment } from "./comments";

test("countAll counts top-level comments plus their replies", () => {
  const cs = [
    { id: "a", replies: [{ id: "a1" }, { id: "a2" }] },
    { id: "b" },
  ] as unknown as Comment[];
  expect(countAll(cs)).toBe(4);
});

test("countAll never crashes on a non-array (e.g. an API error body)", () => {
  expect(countAll({ error: "list failed" } as unknown as Comment[])).toBe(0);
  expect(countAll(null as unknown as Comment[])).toBe(0);
  expect(countAll(undefined as unknown as Comment[])).toBe(0);
});
