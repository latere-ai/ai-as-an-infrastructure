import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "..", "..");

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("generated zh SVG figures use localized visible labels", () => {
  const wholeStack = read("zh/figures/whole-stack-1.svg");
  expect(wholeStack).toContain(">数据</text>");
  expect(wholeStack).toContain(">约束压力</text>");
  expect(wholeStack).not.toContain(">data</text>");
  expect(wholeStack).not.toContain("constraint pressure");

  const benchmarks = read("zh/figures/benchmarks-1.svg");
  expect(benchmarks).toContain(">天花板</text>");
  expect(benchmarks).toContain(">原始基准</text>");
  expect(benchmarks).not.toContain(">ceiling</text>");
  expect(benchmarks).not.toContain("original benchmark");

  const curation = read("zh/figures/data-curation-1.svg");
  expect(curation).toContain(">全量两两比较 O(n²)</text>");
  expect(curation).not.toContain("All-pairs O(n");
});

test("hand-authored zh diagrams do not keep English explanatory labels", () => {
  const multimodalServing = read("zh/inference/06-serving-multimodal.qmd");
  expect(multimodalServing).toContain('IMG["原始像素"]');
  expect(multimodalServing).not.toContain('IMG["raw pixels"]');

  const security = read("zh/safety/03-security-authorization.qmd");
  expect(security).toContain("被注入的指令");
  expect(security).toContain("用户身份");
  expect(security).not.toContain("Injected instruction");
  expect(security).not.toContain("User identity");

  const rag = read("zh/orchestration/06-rag-retrieval.qmd");
  expect(rag).toContain('naive [label="朴素 RAG');
  expect(rag).toContain("双编码器（检索）");
  expect(rag).not.toContain("naive RAG");
  expect(rag).not.toContain("bi-encoder (retrieve)");
});
