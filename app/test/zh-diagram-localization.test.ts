import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";

const repoRoot = join(import.meta.dir, "..", "..");

function read(path: string): string {
  return readFileSync(join(repoRoot, path), "utf8");
}

function tickLabelOffset(svg: string, label: string): number {
  const labelIndex = svg.indexOf(`>${label}</text>`);
  expect(labelIndex, `${label} should exist as SVG text`).toBeGreaterThan(0);

  const prefix = svg.slice(0, labelIndex);
  const tickStart = prefix.lastIndexOf('<g id="xtick_');
  expect(tickStart, `${label} should be inside an x tick group`).toBeGreaterThan(0);

  const tickBlock = svg.slice(tickStart, labelIndex);
  const tickMatch = tickBlock.match(/<use[^>]* x="([0-9.]+)"/);
  expect(tickMatch, `${label} should have a tick x coordinate`).not.toBeNull();

  const textStart = prefix.lastIndexOf("<text");
  expect(textStart, `${label} should have a text element`).toBeGreaterThan(0);

  const textTag = svg.slice(textStart, svg.indexOf(">", textStart) + 1);
  const translateMatch = textTag.match(/translate\(([0-9.]+) [0-9.]+\)/);
  const xMatch = textTag.match(/\sx="([0-9.]+)"/);
  expect(translateMatch ?? xMatch, `${label} should expose a label x coordinate`).not.toBeNull();

  return Number(tickMatch![1]) - Number((translateMatch ?? xMatch)![1]);
}

function textPosition(svg: string, label: string): { x: number; y: number } {
  const textIndex = svg.indexOf(`>${label}</text>`);
  if (textIndex >= 0) {
    const textStart = svg.slice(0, textIndex).lastIndexOf("<text");
    const textTag = svg.slice(textStart, svg.indexOf(">", textStart) + 1);
    const xMatch = textTag.match(/\sx="([0-9.]+)"/);
    const yMatch = textTag.match(/\sy="([0-9.]+)"/);
    expect(xMatch && yMatch, `${label} should expose x/y coordinates`).not.toBeNull();
    return { x: Number(xMatch![1]), y: Number(yMatch![1]) };
  }

  const commentIndex = svg.indexOf(`<!-- ${label} -->`);
  expect(commentIndex, `${label} should exist as an SVG text comment`).toBeGreaterThan(0);

  const fragment = svg.slice(commentIndex, commentIndex + 800);
  const transformMatch = fragment.match(/transform="translate\(([0-9.]+) ([0-9.]+)\)/);
  expect(transformMatch, `${label} should expose a translated text position`).not.toBeNull();
  return { x: Number(transformMatch![1]), y: Number(transformMatch![2]) };
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

  const tokenStorage = read("zh/figures/tokenization-1.svg");
  expect(tokenStorage).toContain("词元索引参数存储量（GiB）");
  expect(tokenStorage).toContain("输入 / 输出权重绑定");
  expect(tokenStorage).not.toContain("tied input / output weights");

  const tokenAudit = read("zh/figures/tokenization-2.svg");
  expect(tokenAudit).toContain("固定平行文本");
  expect(tokenAudit).toContain("词元溢价分布");
  expect(tokenAudit).not.toContain("Pinned parallel text");

  const transformerCache = read("zh/figures/transformer-architecture-1.svg");
  expect(transformerCache).toContain("KV 有效载荷（GiB）");
  expect(transformerCache).toContain("7B 权重（每参数 2 字节）");
  expect(transformerCache).not.toContain("KV payload (GiB)");

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

test("localized zh bar-chart ticks are positioned from zh label widths", () => {
  const borrowedIdeas = read("zh/figures/borrowed-ideas-1.svg");

  for (const label of ["压缩", "TD 误差", "扩散", "涌现"]) {
    expect(tickLabelOffset(borrowedIdeas, label)).toBeLessThan(45);
  }
});

test("scaling-law extrapolation annotations do not overlap the legend", () => {
  const enScalingLaw = read("en/figures/scaling-laws-1.svg");
  const zhScalingLaw = read("zh/figures/scaling-laws-1.svg");

  expect(textPosition(enScalingLaw, "extrapolate").y).toBeGreaterThan(textPosition(enScalingLaw, "forecast large run").y + 12);
  expect(textPosition(zhScalingLaw, "外推").y).toBeGreaterThan(textPosition(zhScalingLaw, "预测大规模运行").y + 12);
});

test("hand-authored zh diagrams do not keep English explanatory labels", () => {
  const multimodalServing = read("zh/inference/06-serving-multimodal.qmd");
  expect(multimodalServing).toContain('IMG [label="媒体字节"]');
  expect(multimodalServing).not.toContain('label="raw pixels"');

  const security = read("zh/safety/03-security-authorization.qmd");
  expect(security).toContain('a [label="验证声明"]');
  expect(security).toContain('e [label="策略执行点执行一次"]');
  expect(security).not.toContain('label="Authenticate claims"');
  expect(security).not.toContain('label="PEP executes once"');

  const rag = read("zh/orchestration/08-rag-retrieval.qmd");
  expect(rag).toContain('source [label="来源 + ACL"]');
  expect(rag).toContain('scope [label="已授权范围"]');
  expect(rag).toContain('answer [label="回答、引用或不作答"]');
  expect(rag).not.toContain('label="authorized scope"');
  expect(rag).not.toContain("bi-encoder (retrieve)");
});
