import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const workflow = readFileSync(
  new URL("../../.github/workflows/book.yml", import.meta.url),
  "utf8",
);
const requirements = readFileSync(
  new URL("../requirements-test.txt", import.meta.url),
  "utf8",
);

test("book CI provisions the Python packages used by executable chapter tests", () => {
  expect(workflow).toMatch(/actions\/setup-python@[0-9a-f]{40} # v\d+\.\d+\.\d+/);
  expect(workflow).toContain("python -m pip install --requirement requirements-test.txt");
  expect(requirements).toMatch(/^numpy==\d+\.\d+\.\d+$/m);
  expect(requirements).toMatch(/^matplotlib==\d+\.\d+\.\d+$/m);
});
