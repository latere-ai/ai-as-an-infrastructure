import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../../.github/workflows/render.yml", import.meta.url),
  "utf8",
);
const requirements = readFileSync(
  new URL("../requirements-test.txt", import.meta.url),
  "utf8",
);

test("render CI provisions the Python packages used by executable chapter tests", () => {
  expect(workflow).toContain("actions/setup-python@v6");
  expect(workflow).toContain("python -m pip install --requirement requirements-test.txt");
  expect(requirements).toMatch(/^numpy==\d+\.\d+\.\d+$/m);
  expect(requirements).toMatch(/^matplotlib==\d+\.\d+\.\d+$/m);
});
