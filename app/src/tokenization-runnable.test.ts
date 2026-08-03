import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/foundations/03-tokenization.qmd", import.meta.url),
  "utf8",
);

test("the tokenization cell freezes learned merges before encoding held-out words", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();

  const python = Bun.which("python3");
  expect(python).not.toBeNull();

  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(run.stdout);
  const stderr = new TextDecoder().decode(run.stderr);

  expect(run.exitCode, stderr).toBe(0);
  expect(stdout).toContain("low     -> low</w>  (1 pieces)");
  expect(stdout).toContain("lowest  -> low est</w>  (2 pieces)");
  expect(stdout).toContain("lobster -> lo <unk> s t er </w>  (6 pieces)");
  expect(stdout).toContain("UTF-8 bytes for 🐍: [240, 159, 144, 141]");
  expect(cell![1]).toContain("def encode_word(word):");
  expect(cell![1]).toContain("(-counts[candidate], candidate)");
});
