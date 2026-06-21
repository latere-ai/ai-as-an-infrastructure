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
      "en/adaptation/01-sft-peft.qmd",
      ["small, low-rank, additive, composable", "rank-16 adapter approximates", "QLoRA", "two fine-tunes can be added together"],
    ],
    [
      "zh/adaptation/01-sft-peft.qmd",
      ["小的、低秩", "rank-16 的适配器能近似替代", "QLoRA", "两次微调能相加到一起"],
    ],
    [
      "en/adaptation/02-rlhf-reward-modeling.qmd",
      ["train a reward model on human", "comparisons", "optimize a policy against that reward with @gls-ppo", "constitutional and @gls-rlaif variants", "learned reward needs a KL constraint"],
    ],
    [
      "zh/adaptation/02-rlhf-reward-modeling.qmd",
      ["人类比较上训练一个奖励模型", "用 @gls-ppo 针对这个奖励优化策略", "宪法式方法与", "@gls-rlaif 变体", "习得奖励需要 KL 约束"],
    ],
    [
      "en/adaptation/03-dpo-variants.qmd",
      ["collapses the", "apparatus into a single classification loss", "language model is an implicit reward model", "none of the variants reliably", "beats the plain loss", "pipeline and data constraints"],
    ],
    [
      "zh/adaptation/03-dpo-variants.qmd",
      ["化约为一个分类损失", "语言模型隐式地就是一个奖励模型", "没有哪个变体能可靠地胜过", "基础 DPO 损失", "流水线与数据约束"],
    ],
    [
      "en/adaptation/04-synthetic-data-self-improvement.qmd",
      ["fresh human labels stop scaling", "a stronger model, the model's own", "filtered outputs", "critic, or a verifier", "data flywheel", "bounded by the quality of the judge"],
    ],
    [
      "zh/adaptation/04-synthetic-data-self-improvement.qmd",
      ["训练信号就必须来自别处", "数据飞轮", "每个回路都有自己的天花板", "受判断者质量所界定"],
    ],
    [
      "en/reasoning/01-eliciting-reasoning.qmd",
      ["@gls-cot helps because", "sampling many chains and voting helps", "useful branches", "verifier is the component that turns best-of-N"],
    ],
    [
      "zh/reasoning/01-eliciting-reasoning.qmd",
      ["@gls-cot管用", "采样许多条链再投票更稳", "问题存在可探索分支", "验证器则是把 best-of-N"],
    ],
    [
      "en/reasoning/02-training-to-reason.qmd",
      ["checkable ground", "truth rather than a learned human-preference proxy", "removes the learned proxy gap", "dropping the critic", "long-horizon reasoning can emerge", "reweights what the base model could already sample"],
    ],
    [
      "zh/reasoning/02-training-to-reason.qmd",
      ["可核查的真值", "移除了习得代理缺口", "丢掉了评论者", "没有步级监督也能产出长程推理", "重加权了基座模型本来就能采样到的路径"],
    ],
    [
      "en/reasoning/03-inference-time-scaling.qmd",
      ["Repeated sampling buys coverage but not an answer", "sequential", "revision and parallel search", "compute-optimal allocation routes a budget", "selector is imperfect"],
    ],
    [
      "zh/reasoning/03-inference-time-scaling.qmd",
      ["重复采样买到的是覆盖率，而不是答案", "串行修订与并行搜索", "计算最优分配按问题难度调度预算", "选择器并不完美"],
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
    [
      "en/inference/03-faster-decoding.qmd",
      ["one target pass verifies several guesses", "Speculative decoding", "Medusa, Hydra, the EAGLE line", "memory-bound regime"],
    ],
    [
      "zh/inference/03-faster-decoding.qmd",
      ["一次目标传播验证多个猜测", "@gls-speculative-decoding", "Medusa、Hydra、EAGLE 系列", "小批大小的内存受限场景"],
    ],
    [
      "en/inference/04-quantization-kernels.qmd",
      ["makes weights or activations smaller", "attention intermediates off high-bandwidth memory", "GPTQ, AWQ, and SmoothQuant", "FlashAttention"],
    ],
    [
      "zh/inference/04-quantization-kernels.qmd",
      ["量化把权重或激活表示得更小", "融合算子把注意力中间结果留在高带宽内存之外", "GPTQ、AWQ 与 SmoothQuant", "FlashAttention"],
    ],
    [
      "en/inference/05-structured-long-context.qmd",
      ["masks logits against a @gls-fsm", "precomputed index and jump-forward", "decides which keys and values survive", "heavy-hitter eviction"],
    ],
    [
      "zh/inference/05-structured-long-context.qmd",
      ["拿 logits 对照一台@gls-fsm做掩码", "预计算索引和跳跃式前向", "滑动窗口、@gls-attention-sink 与重击者驱逐", "查询感知策略"],
    ],
    [
      "en/inference/06-serving-multimodal.qmd",
      ["chooses the visual token count", "serving-cost decision", "encoder placement", "Image prefix caching"],
    ],
    [
      "zh/inference/06-serving-multimodal.qmd",
      ["视觉编码器决定视觉 token 数", "分辨率设置就是服务成本决策", "编码器放在哪里也是服务决策", "图像前缀缓存"],
    ],
    [
      "en/infrastructure/01-accelerators-networking.qmd",
      ["bandwidth hierarchy", "tensor-parallel group almost never spills past the NVLink boundary", "model FLOPs utilization"],
    ],
    [
      "zh/infrastructure/01-accelerators-networking.qmd",
      ["带宽层级", "张量并行组几乎不越过 NVLink 边界", "模型 FLOPs 利用率"],
    ],
    [
      "en/infrastructure/02-orchestration-data-infra.qmd",
      ["checkpointing, the data plane, and observability", "how often to save", "how data order", "survives a restart"],
    ],
    [
      "zh/infrastructure/02-orchestration-data-infra.qmd",
      ["检查点、数据层与可观测性", "多久保存一次", "数据顺序如何跨过重启"],
    ],
    [
      "en/infrastructure/03-the-compute-frontier.qmd",
      ["scarce resource is bytes rather than arithmetic", "accelerators have become chiplet packages", "NVLink boundary has moved from", "rising arithmetic-intensity floor"],
    ],
    [
      "zh/infrastructure/03-the-compute-frontier.qmd",
      ["稀缺的资源是字节，而不是算术", "小芯片封装", "NVLink 边界从机箱移到机架", "不断抬高的算术强度地板"],
    ],
    [
      "en/infrastructure/04-making-the-silicon.qmd",
      ["moved down the stack from the", "transistor to the package and the memory stack", "silicon interposer can rate-limit", "memory shortage now", "reaches all the way out", "export controls and", "sovereign-compute programs"],
    ],
    [
      "zh/infrastructure/04-making-the-silicon.qmd",
      ["从晶体管移到了封装和内存堆栈", "硅中介层就能限速整个领域", "内存短缺如今一路波及", "出口管制和主权算力计划"],
    ],
    [
      "en/infrastructure/05-powering-it.qmd",
      ["not generation capacity but time-to-power", "self-generates rather than waits for the grid", "liquid cooling as the default", "grid operator must actively manage"],
    ],
    [
      "zh/infrastructure/05-powering-it.qmd",
      ["不是发电容量，而是通电时间", "选择自发电，而不再等电网", "新的散热默认值", "电网运营商必须主动管理"],
    ],
    [
      "en/infrastructure/06-the-machine-that-breaks.qmd",
      ["failing somewhere almost all the time", "preventing failures to amortizing them", "raise no alarm", "latency hierarchy and the decode bandwidth wall", "agent that runs for hours"],
    ],
    [
      "zh/infrastructure/06-the-machine-that-breaks.qmd",
      ["几乎在任何时刻都有某处在出故障", "预防故障」转向了「摊销故障", "不拉警报", "延迟层级和解码带宽墙", "连跑数小时的智能体"],
    ],
    [
      "en/infrastructure/07-where-learning-hits-limits.qmd",
      ["cheap resource that powered", "synthetic data, reinforcement learning on reasoning", "imitate a finite corpus", "change that answer rather than defer it"],
    ],
    [
      "zh/infrastructure/07-where-learning-hits-limits.qmd",
      ["廉价资源正在见底", "数据墙、合成数据、在推理上做强化学习", "模仿一个有限的语料", "真正改变了这个答案"],
    ],
    [
      "en/infrastructure/08-the-capability-horizon.qmd",
      ["frontier is no longer a leaderboard number", "moving horizon", "instruments saturate faster than they can be built", "durable progress", "compute-bought artifact", "headline number"],
    ],
    [
      "zh/infrastructure/08-the-capability-horizon.qmd",
      ["不再是一个排行榜数字", "移动的地平线", "测量仪器饱和得比新仪器造出来还快", "可持续的进步", "用算力买来的表象"],
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
    "en/adaptation/01-sft-peft.qmd",
    "en/adaptation/02-rlhf-reward-modeling.qmd",
    "en/adaptation/03-dpo-variants.qmd",
    "en/adaptation/04-synthetic-data-self-improvement.qmd",
    "en/reasoning/index.qmd",
    "en/reasoning/01-eliciting-reasoning.qmd",
    "en/reasoning/02-training-to-reason.qmd",
    "en/reasoning/03-inference-time-scaling.qmd",
    "en/inference/01-serving-problem.qmd",
    "en/inference/02-memory-scheduling.qmd",
    "en/inference/03-faster-decoding.qmd",
    "en/inference/04-quantization-kernels.qmd",
    "en/inference/05-structured-long-context.qmd",
    "en/inference/06-serving-multimodal.qmd",
    "en/infrastructure/01-accelerators-networking.qmd",
    "en/infrastructure/02-orchestration-data-infra.qmd",
    "en/infrastructure/03-the-compute-frontier.qmd",
    "en/infrastructure/04-making-the-silicon.qmd",
    "en/infrastructure/05-powering-it.qmd",
    "en/infrastructure/06-the-machine-that-breaks.qmd",
    "en/infrastructure/07-where-learning-hits-limits.qmd",
    "en/infrastructure/08-the-capability-horizon.qmd",
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
    "zh/adaptation/01-sft-peft.qmd",
    "zh/adaptation/02-rlhf-reward-modeling.qmd",
    "zh/adaptation/03-dpo-variants.qmd",
    "zh/adaptation/04-synthetic-data-self-improvement.qmd",
    "zh/reasoning/index.qmd",
    "zh/reasoning/01-eliciting-reasoning.qmd",
    "zh/reasoning/02-training-to-reason.qmd",
    "zh/reasoning/03-inference-time-scaling.qmd",
    "zh/inference/01-serving-problem.qmd",
    "zh/inference/02-memory-scheduling.qmd",
    "zh/inference/03-faster-decoding.qmd",
    "zh/inference/04-quantization-kernels.qmd",
    "zh/inference/05-structured-long-context.qmd",
    "zh/inference/06-serving-multimodal.qmd",
    "zh/infrastructure/01-accelerators-networking.qmd",
    "zh/infrastructure/02-orchestration-data-infra.qmd",
    "zh/infrastructure/03-the-compute-frontier.qmd",
    "zh/infrastructure/04-making-the-silicon.qmd",
    "zh/infrastructure/05-powering-it.qmd",
    "zh/infrastructure/06-the-machine-that-breaks.qmd",
    "zh/infrastructure/07-where-learning-hits-limits.qmd",
    "zh/infrastructure/08-the-capability-horizon.qmd",
  ];
  const banned = /By the end|This chapter is about|This chapter tells one story|读者读完|读完这一部分|本章把一个故事/;

  for (const path of polished) {
    const text = readFileSync(join(repoRoot, path), "utf8");
    const opening = text.split(/\n## /)[0] ?? text;
    expect(opening, `${path} should not use a reader-promise opener`).not.toMatch(banned);
  }
});
