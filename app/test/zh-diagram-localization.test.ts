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
