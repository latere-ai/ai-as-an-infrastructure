import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "..", "..");

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

test("generated zh SVG figures use localized visible labels", () => {
  const benchmarks = read("zh/figures/benchmarks-1.svg");
  expect(benchmarks).toContain(">天花板</text>");
  expect(benchmarks).toContain(">原始基准</text>");
  expect(benchmarks).not.toContain(">ceiling</text>");
  expect(benchmarks).not.toContain("original benchmark");

  const curation = read("zh/figures/data-curation-1.svg");
  expect(curation).toContain(">全量两两比较 O(n²)</text>");
  expect(curation).not.toContain("All-pairs O(n");

  const sequenceGrowth = read("zh/figures/moe-ssm-hybrids-1.svg");
  expect(sequenceGrowth).toContain("注意力关系（二次增长）");
  expect(sequenceGrowth).toContain("相对 1K 词元的增长倍数");
  expect(sequenceGrowth).not.toContain("Attention relationships (quadratic)");

  const moeParameters = read("zh/figures/moe-ssm-hybrids-2.svg");
  expect(moeParameters).toContain("存储的参数");
  expect(moeParameters).toContain("每词元实际计算的参数");
  expect(moeParameters).toContain("路由专家数 E（选中 k = 2）");
  expect(moeParameters).not.toContain("Parameters evaluated per token");
});

test("hand-authored zh diagrams do not keep English explanatory labels", () => {

  const rag = read("zh/orchestration/08-rag-retrieval.qmd");
  expect(rag).toContain('source [label="来源 + ACL"]');
  expect(rag).toContain('scope [label="已授权范围"]');
  expect(rag).toContain('answer [label="回答、引用或不作答"]');
  expect(rag).not.toContain('label="authorized scope"');
  expect(rag).not.toContain("bi-encoder (retrieve)");
});
