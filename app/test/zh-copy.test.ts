import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";

const zhRoot = join(import.meta.dir, "..", "..", "zh");
const repoRoot = join(import.meta.dir, "..", "..");
const deprecatedLabel = "约束" + "箭头";

function qmdFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...qmdFiles(path));
    else if (entry.name.endsWith(".qmd")) out.push(path);
  }
  return out;
}

test("zh source uses 下层约束 instead of the calqued old label", () => {
  const offenders = qmdFiles(zhRoot).filter((path) =>
    readFileSync(path, "utf8").includes(deprecatedLabel),
  );
  expect(offenders.map((path) => path.replace(zhRoot + "/", ""))).toEqual([]);
});

test("polished chapter openings preserve key source theses", () => {
  const checks: Array<[string, string[]]> = [
    [
      "en/foundations/01-scaling-laws.qmd",
      ["Kaplan-era parameter-heavy", "Chinchilla-style data allocation", "inference-aware"],
    ],
    [
      "zh/foundations/01-scaling-laws.qmd",
      ["Kaplan 时代偏向参数", "Chinchilla 式的数据分配", "推理感知的过度训练"],
    ],
    [
      "en/foundations/03-tokenization.qmd",
      ["byte-level BPE", "Unigram", "tokenizer-free"],
    ],
    [
      "zh/foundations/03-tokenization.qmd",
      ["字节级 BPE", "Unigram", "无分词器"],
    ],
    [
      "en/foundations/05-moe-ssm-hybrids.qmd",
      ["router", "almost for free", "starving experts"],
    ],
    [
      "zh/foundations/05-moe-ssm-hybrids.qmd",
      ["路由器", "几乎免费地增长", "专家不能饿死"],
    ],
    [
      "en/generative/01-diffusion-flow-matching.qmd",
      ["almost all non-text media", "denoiser, score, or velocity", "thousand evaluations"],
    ],
    [
      "zh/generative/01-diffusion-flow-matching.qmd",
      ["几乎所有非文本媒体", "去噪器、分数或速度", "一千次网络评估"],
    ],
    [
      "en/generative/02-nar-diffusion-lms.qmd",
      ["autoregressive teacher", "discrete diffusion", "2025 wave"],
    ],
    [
      "zh/generative/02-nar-diffusion-lms.qmd",
      ["自回归教师", "离散扩散", "2025 年那波"],
    ],
    [
      "en/generative/03-speech-and-voice.qmd",
      ["weak supervision", "semantic tokens", "flow-matching routes"],
    ],
    [
      "zh/generative/03-speech-and-voice.qmd",
      ["弱监督", "语义词元", "流匹配"],
    ],
    [
      "en/generative/04-multimodal-models.qmd",
      ["image token count", "classifier-free guidance", "continuous representation fight"],
    ],
    [
      "zh/generative/04-multimodal-models.qmd",
      ["图像词元数", "无分类器引导", "离散表示与连续表示"],
    ],
    [
      "en/generative/05-beyond-text.qmd",
      ["The early evidence leans toward the latter", "carried more by free data"],
    ],
    [
      "zh/generative/05-beyond-text.qmd",
      ["早期证据更支持后一种读法", "更多是由现成数据支撑起来的"],
    ],
    [
      "en/inference/01-serving-problem.qmd",
      ["prefill reads the", "decode emits one token at a time", "Goodput, not raw throughput or raw latency", "key-value cache"],
    ],
    [
      "zh/inference/01-serving-problem.qmd",
      ["@gls-prefill先读完整个提示词", "@gls-decode一次只发出一个词元", "真正的目标是@gls-goodput", "KV 缓存"],
    ],
    [
      "en/inference/02-memory-scheduling.qmd",
      ["Continuous batching removes static-batch waste", "PagedAttention removes fragmented cache", "Radix-tree prefix caching", "Phase splitting removes"],
    ],
    [
      "zh/inference/02-memory-scheduling.qmd",
      ["连续批处理消除静态批的浪费", "@gls-pagedattention 消除缓存碎片化", "基数树前缀缓存", "阶段拆分"],
    ],
  ];

  for (const [path, snippets] of checks) {
    const text = readFileSync(join(repoRoot, path), "utf8");
    for (const snippet of snippets) {
      expect(text, `${path} should preserve ${snippet}`).toContain(snippet);
    }
  }
});

test("polished chapter openings avoid reader-promise templates", () => {
  const polished = [
    "en/orientation/01-whole-stack.qmd",
    "en/orientation/02-field-map.qmd",
    "en/orientation/03-borrowed-ideas.qmd",
    "en/foundations/01-scaling-laws.qmd",
    "en/foundations/02-data-curation.qmd",
    "en/foundations/03-tokenization.qmd",
    "en/foundations/04-transformer-architecture.qmd",
    "en/foundations/05-moe-ssm-hybrids.qmd",
    "en/foundations/06-training-at-scale.qmd",
    "en/generative/01-diffusion-flow-matching.qmd",
    "en/generative/02-nar-diffusion-lms.qmd",
    "en/generative/03-speech-and-voice.qmd",
    "en/generative/04-multimodal-models.qmd",
    "en/generative/05-beyond-text.qmd",
    "en/inference/01-serving-problem.qmd",
    "en/inference/02-memory-scheduling.qmd",
    "zh/orientation/01-whole-stack.qmd",
    "zh/orientation/02-field-map.qmd",
    "zh/orientation/03-borrowed-ideas.qmd",
    "zh/foundations/01-scaling-laws.qmd",
    "zh/foundations/02-data-curation.qmd",
    "zh/foundations/03-tokenization.qmd",
    "zh/foundations/04-transformer-architecture.qmd",
    "zh/foundations/05-moe-ssm-hybrids.qmd",
    "zh/foundations/06-training-at-scale.qmd",
    "zh/generative/01-diffusion-flow-matching.qmd",
    "zh/generative/02-nar-diffusion-lms.qmd",
    "zh/generative/03-speech-and-voice.qmd",
    "zh/generative/04-multimodal-models.qmd",
    "zh/generative/05-beyond-text.qmd",
    "zh/inference/01-serving-problem.qmd",
    "zh/inference/02-memory-scheduling.qmd",
  ];
  const banned = /By the end|This chapter tells one story|读者读完本章|本章把一个故事/;

  for (const path of polished) {
    const text = readFileSync(join(repoRoot, path), "utf8");
    const opening = text.split(/\n## /)[0] ?? text;
    expect(opening, `${path} should not use a reader-promise opener`).not.toMatch(banned);
  }
});
