import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const english = readFileSync(new URL("../../en/reasoning/summary.qmd", import.meta.url), "utf8");
const chapter = readFileSync(new URL("../../zh/reasoning/summary.qmd", import.meta.url), "utf8");

function bodyParagraphs(source: string): string[] {
  return source
    .split(/\n\s*\n/)
    .slice(1)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

test("the Chinese Part IV summary preserves the complete English shape", () => {
  expect(chapter).toStartWith("# 小结 {#part-reasoning-summary .unnumbered}\n");
  expect(bodyParagraphs(chapter)).toHaveLength(3);
  expect(chapter.match(/^## /gm)).toBeNull();
  expect([...chapter.matchAll(/@[A-Za-z0-9_-]+/g)].map((match) => match[0])).toEqual(
    [...english.matchAll(/@[A-Za-z0-9_-]+/g)].map((match) => match[0]),
  );
});

test("the first paragraph retains every reasoning control route", () => {
  for (const phrase of [
    "把推理视为一个计算控制问题",
    "提示本身",
    "推理链、搜索树、程序、求解器调用或证明脚本",
    "验证器从候选中选择",
    "让模型更稳定地产生有用的推理轨迹",
    "根据请求难度，在推断时临时增加算力",
  ]) {
    expect(bodyParagraphs(chapter)[0]).toContain(phrase);
  }
});

test("the second paragraph turns conditional benefits into operating questions", () => {
  for (const phrase of [
    "确实有效，但都有适用条件",
    "提高候选覆盖率和最终选择质量",
    "掩盖故障",
    "拉长延迟",
    "难度尚未测清的任务",
    "额外工作在哪里发生",
    "由谁核查",
    "保留哪些轨迹",
    "循环依据什么规则停止",
  ]) {
    expect(bodyParagraphs(chapter)[1]).toContain(phrase);
  }
});

test("the closing defines the system and hands routing to serving", () => {
  for (const phrase of [
    "神秘的内在能力",
    "预算、搜索空间、验证器、轨迹和停止规则",
    "仍未解决的核心问题是路由",
    "测试时算力何时还能继续带来收益",
    "何时已经饱和",
    "如何把有限的推理预算分配给真实工作负载",
    "第五部分会把这个路由问题转化为服务系统中的具体机制",
    "延迟、批处理、缓存驻留和价格",
    "系统能否在产品中提供这部分额外推理",
  ]) {
    expect(bodyParagraphs(chapter)[2]).toContain(phrase);
  }
});

test("the rewrite removes translated and machine-like formulations", () => {
  for (const phrase of [
    "可调节的杠杆",
    "潜在的工作",
    "固化成更稳定的习惯",
    "改善选择",
    "遮住失败",
    "难度从未被度量过",
    "服务机器",
    "额外思考到底能不能被交付",
    "—",
  ]) {
    expect(chapter).not.toContain(phrase);
  }
});
