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
  ];

  for (const [path, snippets] of checks) {
    const text = readFileSync(join(repoRoot, path), "utf8");
    for (const snippet of snippets) {
      expect(text, `${path} should preserve ${snippet}`).toContain(snippet);
    }
  }
});
