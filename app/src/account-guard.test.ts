// A malformed /api/view response once reached ChapterStats, whose render
// threw, and React unmounted the reader with the chapter text in it.
import { expect, test } from "bun:test";
import { Contained, parseStats } from "./account.tsx";

test("view counts render only from a well-formed response", () => {
  expect(parseStats({ views: 3, visitors: 2 })).toEqual({ views: 3, visitors: 2 });
  for (const bad of [null, undefined, {}, [], "x", { views: "3", visitors: 2 }, { views: 3 }, { error: "rate limited" }]) {
    expect(parseStats(bad)).toBeNull();
  }
});

test("a widget that throws renders nothing instead of taking the page down", () => {
  expect(Contained.getDerivedStateFromError()).toEqual({ failed: true });
  const c = new Contained({ children: "widget" });
  expect(c.render()).toBe("widget");
  c.state = { failed: true };
  expect(c.render()).toBeNull();
});
