import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const chapter = readFileSync(
  new URL("../../en/foundations/04-transformer-architecture.qmd", import.meta.url),
  "utf8",
);

test("the transformer cell computes KV payloads from explicit byte units", () => {
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
  expect(stdout).toContain(
    "MHA: 512 KiB/token; 128k cache=62.50 GiB; equals weight bytes at 26,703 tokens",
  );
  expect(stdout).toContain(
    "GQA: 128 KiB/token; 128k cache=15.62 GiB; equals weight bytes at 106,812 tokens",
  );
  expect(stdout).toContain(
    "MQA: 16 KiB/token; 128k cache=1.95 GiB; equals weight bytes at 854,492 tokens",
  );
  expect(cell![1]).toContain("def kv_payload_bytes(sequence_length, kv_heads):");
  expect(cell![1]).toContain("/ 2**30");
  expect(cell![1]).not.toContain("per_tok/1024");
});
