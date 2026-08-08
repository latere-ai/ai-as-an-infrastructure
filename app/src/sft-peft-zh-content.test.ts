import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const en = readFileSync(
  new URL("../../en/adaptation/01-sft-peft.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/adaptation/01-sft-peft.qmd", import.meta.url),
  "utf8",
);
const vizRuntime = readFileSync(
  new URL("./runtime/viz.ts", import.meta.url),
  "utf8",
);

function count(source: string, pattern: RegExp): number {
  return [...source.matchAll(pattern)].length;
}

function citations(source: string): string[] {
  return [...new Set([...source.matchAll(/\[@([\w-]+)/g)].map(([, key]) => key))].sort();
}

test("Chapter 17 separates the SFT signal from the PEFT update", () => {
  expect(zh).toContain("两者行为不同，是因为训练时拟合的条件分布不同");
  expect(zh).toContain("预训练奖励的是符合上下文的文本续写");
  expect(zh).toContain("监督微调（SFT）奖励的是在指定对话之后生成指定回复");
  expect(zh).toContain("SFT 与 PEFT 回答的是两个不同的问题");
  expect(zh).toContain("SFT 是目标函数与数据流水线，LoRA 则是参数化更新的一种方式");
});

test("conversation serialization and target masking are explicit", () => {
  expect(zh).toContain("## 把对话转成有监督训练所需的词元");
  expect(zh).toContain("训练与服务必须使用同一套模板");
  expect(zh).toContain(String.raw`u_{1:T}=(u_1,\ldots,u_T)`);
  expect(zh).toContain(String.raw`M=\sum_{t=1}^{T}m_t`);
  expect(zh).toContain("损失按目标词元数取平均");
  expect(zh).toContain("是否只给助手回复计分是一项策略选择，而不是 SFT 的定义");
});

test("the masking figure preserves the complete localized pipeline", () => {
  expect(zh).toContain("label: fig-sft-peft-masking");
  for (const phrase of [
    "结构化对话\\n角色与消息内容",
    "精确的对话模板\\n角色与轮次边界",
    "词元序列 u_1 ... u_T",
    "上下文位置\\nm_t = 0",
    "助手目标位置\\nm_t = 1",
    "带掩码的下一词元损失",
    "优化器更新\\n允许变化的参数",
    "作为预测条件",
  ]) expect(zh).toContain(phrase);
});

test("implementation details distinguish boundaries, truncation, packing, and weighting", () => {
  for (const phrase of [
    "轮次结束词元决定模型是否学会停下",
    "左侧截断可能删掉指令，右侧截断可能删掉回答或停止词元",
    "拼接短记录可以提高加速器利用率",
    "按词元平均的损失会让长回答获得更大权重",
    "教师强制",
    "完整对话回放必须单独评测",
  ]) expect(zh).toContain(phrase);
});

test("SFT evidence is attributed without collapsing later training stages", () => {
  expect(zh).toContain("不能把 InstructGPT 的最终行为只归因于 SFT");
  expect(zh).toContain("在许多任务上做指令调优，可以提高对留出任务类型的泛化能力");
  expect(zh).toContain("效果仍取决于基座模型与训练集");
});

test("data quality preserves the boundary of positive demonstrations", () => {
  expect(zh).toContain("## 数据决定模型模仿什么");
  expect(zh).toContain("SFT 提供的是正向示范");
  expect(zh).toContain("并不直接说明哪个备选答案差一点就能接受");
  expect(zh).toContain("LIMA 的结果不是通用的样本复杂度定律");
  expect(zh).toContain("专门事实、新工具协议、预训练中覆盖不足的语言");
});

test("the dataset audit retains all five concerns", () => {
  for (const row of [
    "| 正确性 | 回答对相应提示是否在事实与流程上都正确？ |",
    "| 覆盖范围 | 包含哪些任务、语言、长度、格式与失败情形？ |",
    "| 混合比例 | 每个来源或能力各占多少目标词元？ |",
    "| 独立性 | 验证集与测试集是否按来源、任务和近重复内容隔离？ |",
    "| 序列化 | 角色词元、工具结构、停止词元与截断方式是否和部署一致？ |",
  ]) expect(zh).toContain(row);

  expect(zh).toContain("长回答会贡献更多目标词元");
  expect(zh).toContain("最大似然训练会奖励模型复现错误示范");
});

test("safety and evaluation remain distribution-aware", () => {
  expect(zh).toContain("@gls-over-refusal，也就是调优后的模型拒绝无害请求");
  expect(zh).toContain("比较基座模型、仅使用提示的基线与调优后模型");
  expect(zh).toContain("开发评测与未见评测分开");
  expect(zh).toContain("训练损失只能说明模型拟合了受监督词元");
});

test("the contested boundary asks what changed on held-out behavior", () => {
  expect(zh).toContain("浅层对齐假说");
  expect(zh).toContain("SFT 也能改变任务能力");
  expect(zh).toContain("哪些留出行为发生了变化");
  expect(zh).toContain("能否仅靠提示从基座模型中引出这些行为");
});

test("the update-strategy table keeps five distinct methods", () => {
  expect(zh).toContain("## 决定哪些参数可以更新");
  for (const method of [
    "| 全量微调 |",
    "| 软提示或前缀 |",
    "| 瓶颈适配器 |",
    "| LoRA |",
    "| QLoRA |",
  ]) expect(zh).toContain(method);
  expect(zh).toContain("冻结参数仍会参与前向与反向计算");
});

test("the memory ledger accounts for every peak-memory term", () => {
  expect(zh).toContain(String.raw`M_{\mathrm{peak}}`);
  for (const term of [
    String.raw`M_{\mathrm{base}}`,
    String.raw`M_{\mathrm{adapter}}`,
    String.raw`M_{\mathrm{grad}}`,
    String.raw`M_{\mathrm{optim}}`,
    String.raw`M_{\mathrm{act}}`,
    String.raw`M_{\mathrm{work}}`,
  ]) expect(zh).toContain(term);
  expect(zh).toContain("实际峰值仍应测量");
});

test("LoRA defines its factorization, parameter count, and capacity boundary", () => {
  expect(zh).toContain("## LoRA 将更新限制为低秩分解");
  expect(zh).toContain("W_0+sBA");
  expect(zh).toContain(String.raw`\operatorname{rank}(sBA)\le r`);
  expect(zh).toContain(String.raw`N_{\mathrm{LoRA}}`);
  expect(zh).toContain("低秩形式是一项容量约束，并不能证明所有有效的微调更新都是低秩的");
  expect(zh).toContain("目标模块的选择与秩同样重要");
});

test("the localized LoRA runnable is exact and dependency-free", () => {
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();

  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const stdout = new TextDecoder().decode(run.stdout).trim();
  const stderr = new TextDecoder().decode(run.stderr);

  expect(run.exitCode, stderr).toBe(0);
  expect(stdout.split("\n")).toEqual([
    "基座矩阵参数量：16,777,216",
    "秩  4： 32,768 个参数（ 0.195%）",
    "秩  8： 65,536 个参数（ 0.391%）",
    "秩 16：131,072 个参数（ 0.781%）",
    "秩 32：262,144 个参数（ 1.562%）",
    "秩 64：524,288 个参数（ 3.125%）",
  ]);
  expect(cell![1]).toContain("adapter = rank * (d_in + d_out)");
  expect(cell![1]).not.toMatch(/numpy|matplotlib|random/);
});

test("QLoRA is bounded as a training-memory technique", () => {
  expect(zh).toContain("## QLoRA 改变冻结基座的存储方式");
  expect(zh).toContain("4 位 NormalFloat 表示");
  expect(zh).toContain("65B 模型在单块 48 GB GPU 上完成微调");
  expect(zh).toContain("这是存在性结果，不是硬件定律");
  expect(zh).toContain("训练精度与部署格式是两回事");
  expect(zh).toContain("并不表示最终服务器的每一步运算都使用 4 位精度");
});

test("merged and switchable adapters retain different operational costs", () => {
  expect(zh).toContain("## 合并适配器与可切换适配器的成本不同");
  expect(zh).toContain(String.raw`W_{\mathrm{merged}}=W_0+sBA`);
  expect(zh).toContain("保留独立分支可以切换适配器");
  expect(zh).toContain("服务器必须把适配器与训练时使用的精确基座架构和参数名配对");
  expect(zh).toContain("一个基座配多个适配器是一种部署设计");
});

test("model merging remains a separate measured approximation", () => {
  expect(zh).toContain("## 权重合并是另一种近似");
  expect(zh).toContain("不要把一条 LoRA 分支合入自身基座，与组合多个独立微调模型混为一谈");
  expect(zh).toContain(String.raw`\tau_i=\theta_i-\theta_0`);
  expect(zh).toContain("共享初始化提供了这种对齐");
  expect(zh).toContain("这些方法只是在处理干扰，并不能保证每个父模型的能力都被保留");
  expect(zh).toContain("联合微调能为联合目标提供直接证据");
});

test("adaptation closes as a controlled experiment", () => {
  expect(zh).toContain("## 把适配当作受控实验");
  for (const phrase of [
    "1. 在查看最终结果前，先定义留出任务与回归测试集",
    "2. 把基座检查点、分词器、对话模板、最大长度与目标掩码策略冻结为同一份版本化契约",
    "3. 审计来源混合、重复、污染、截断与目标词元数",
    "4. 测量基座模型与仅使用提示的基线",
    "5. 扫描学习率以及至少一项容量设置",
    "6. 硬件允许时，用一个小型全量微调基线与 PEFT 比较",
    "7. 评测将要实际服务的确切产物",
  ]) expect(zh).toContain(phrase);

  for (const symptom of [
    "训练损失下降，但对话行为不稳定",
    "目标任务改善，但通用能力下降",
    "LoRA 在小型数据划分上的损失很低，却仍然欠拟合",
    "QLoRA 内存不足",
    "适配器结果正确，但服务很慢",
    "合并模型丢失父模型的一项能力",
  ]) expect(zh).toContain(symptom);
});

test("lower-layer and evidence boundaries stay explicit", () => {
  expect(zh).toContain("训练样本不只是文字");
  expect(zh).toContain("可训练参数量也不等于峰值内存");
  expect(zh).toContain("## 证据边界");
  expect(zh).toContain("SFT 让模型更可能在特定序列化方式下复现示范行为");
  expect(zh).toContain("选择能够通过目标测试与回归测试的最小更新");
  expect(zh).toContain("再验证实际部署的确切产物");
});

test("Chinese Chapter 17 preserves the English artifact and citation contract", () => {
  expect(count(zh, /^\$\$$/gm)).toBe(12);
  expect(count(zh, /^```\{dot\}$/gm)).toBe(2);
  expect(count(zh, /^```\{=html\}$/gm)).toBe(2);
  expect(count(zh, /^:::: \{\.runnable\}$/gm)).toBe(1);
  expect(count(zh, /^\|---/gm)).toBe(3);
  expect(count(zh, /^!\[/gm)).toBe(1);
  expect(zh).toContain('data-viz="lora-lowrank"');
  expect(zh).toContain('data-viz="task-arithmetic"');
  expect(citations(zh)).toEqual(citations(en));
  expect([...zh.matchAll(/@sec-[\w-]+/g)].map(([ref]) => ref)).toEqual([
    "@sec-behavior-specs",
  ]);
});

test("Chapter 17 interactive figures localize their visible controls", () => {
  for (const phrase of [
    "目标更新 ΔW",
    "秩 r",
    "参数",
    "残差",
    "操作：",
    "相加（多任务）",
    "结果",
    "两个任务向量的夹角",
    "方向一致：相互加强",
    "符号冲突：相互抵消",
  ]) expect(vizRuntime).toContain(phrase);
});

test("task arithmetic keeps geometry separate from localized labels", () => {
  const component = vizRuntime.slice(
    vizRuntime.indexOf("R['task-arithmetic']"),
    vizRuntime.indexOf("R['grpo-advantage']"),
  );
  expect(component).toContain("vectorLength = Math.min(W, H) * 0.3");
  expect(component).toContain("/ vectorLength");
});

test("the rewrite removes the obsolete argument and unsupported shortcuts", () => {
  for (const rejected of [
    "为什么几千条样本就能重塑行为",
    "为什么一个 rank-16 适配器能近似替代完整微调",
    "为什么两次微调能被相加到一起",
    "适配，是在一个冻结基座之上做的一个小的、低秩的、加性的、可组合的改变",
    "零增加延迟",
    "质量差距（对指令微调通常可忽略",
    "适配器会绕着它学习",
    "开放模型微调生态之所以形成如今的形态",
    "fig-sft-peft-lineage",
    "fig-sft-peft-curve",
    'data-family="diminishing"',
    "—",
  ]) expect(zh).not.toContain(rejected);
});
