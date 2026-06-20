// Regression test: content that immediately follows a closing fenced div (no
// author-supplied blank line) must not be swallowed into the `</div>` HTML
// block. Without a blank line after `</div>`, a following list / bold /
// citations render as literal text (CommonMark type-6 HTML block absorbs every
// line until the next blank). See zh/p1-foundations/08-training-at-scale.qmd.

import { test, expect } from "bun:test";
import { expandDivs } from "./divs.ts";

test("a closing fence is followed by a blank line so the next block survives", () => {
  const src = [
    ":::: {.runnable}",
    "```python",
    "x = 1",
    "```",
    "::::",
    "- **trade memory for compute.** activation checkpointing [@cite].",
  ].join("\n");

  const out = expandDivs(src);
  const lines = out.split("\n");
  const close = lines.indexOf("</div>");
  expect(close).toBeGreaterThan(-1);
  // The line right after `</div>` must be blank, separating it from the list.
  expect(lines[close + 1]).toBe("");
  // The list line itself must still be present (not consumed).
  expect(out).toContain("- **trade memory for compute.** activation checkpointing [@cite].");
});
