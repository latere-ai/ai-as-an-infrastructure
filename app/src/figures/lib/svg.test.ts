import { expect, test } from "bun:test";
import { text } from "./svg.ts";

test("a one-letter symbol with an underscore is drawn with a subscript", () => {
  const out = text(0, 0, "T_msg = α + n / B", { "font-size": 12 });
  expect(out).toContain('<tspan dy="3.4" font-size="9">msg</tspan>');
  expect(out).not.toContain("T_msg");
  expect(text(0, 0, "梯度 g_i")).toContain(">i</tspan>");
});

test("identifiers with underscores and plain text are left as written", () => {
  expect(text(0, 0, "edit_file")).toBe('<text x="0" y="0">edit_file</text>');
  expect(text(0, 0, "a < b")).toBe('<text x="0" y="0">a &lt; b</text>');
});
