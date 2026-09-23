import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/inference/05-structured-long-context.qmd", import.meta.url),
  "utf8",
);

const bibliography = readFileSync(
  new URL("../../refs/structured-long-context.bib", import.meta.url),
  "utf8",
);

test("the chapter bibliography owns every citation in the chapter", () => {
  const keys = new Set(
    [...chapter.matchAll(/@([a-z]+(?:19|20)\d{2}[a-z0-9]*)/g)].map((match) => match[1]),
  );
  expect(keys.size).toBeGreaterThan(0);
  for (const key of keys) {
    expect(bibliography, `${key} should be owned by this chapter`).toMatch(
      new RegExp(`^@\\w+\\{${key},`, "m"),
    );
  }
});

test("the constrained-softmax runnable is deterministic and rejects a dead state", () => {
  const cell = chapter.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  expect(cell![1]).not.toContain("numpy");
  const python = Bun.which("python3") ?? Bun.which("python");
  expect(python).not.toBeNull();
  const script = `${cell![1]}\ntry:\n    constrained_softmax(logits, set())\nexcept ValueError as error:\n    print(type(error).__name__ + ": " + str(error))`;
  const run = Bun.spawnSync([python!, "-c", script], { stdout: "pipe", stderr: "pipe" });
  expect(run.exitCode, run.stderr.toString()).toBe(0);
  expect(run.stdout.toString()).toContain('     "  1.000');
  expect(run.stdout.toString()).toContain("legal mass: 1.0");
  expect(run.stdout.toString()).toContain("illegal mass: 0.0");
  expect(run.stdout.toString()).toContain("ValueError: empty allowed set");
});
