import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, renderDot } from "./pipeline/diagrams.ts";

const en = readFileSync(
  new URL("../../en/generative/05-beyond-text.qmd", import.meta.url),
  "utf8",
);
const zh = readFileSync(
  new URL("../../zh/generative/05-beyond-text.qmd", import.meta.url),
  "utf8",
);

function uniqueMatches(source: string, pattern: RegExp): string[] {
  return [...new Set([...source.matchAll(pattern)].map((match) => match[1]))].sort();
}

test("Chapter 16 preserves the complete English section architecture", () => {
  for (const heading of [
    "## 分开讨论生成、动力学、规划与控制",
    "## 为世界模型定义动作接口",
    "## 视觉真实感不是干预测试",
    "## 选择模型必须保留的信息",
    "### 规划把预测误差带入决策",
    "## 共享主干还不等于世界模型",
    "## 机器人策略有明确的物理输出契约",
    "### 分清控制步数与模型调用",
    "## 先看数据差异，再谈数据稀缺",
    "## 评测闭环",
    "## 争议所在",
    "## 下层约束",
    "## 证据边界",
    "## 延伸阅读",
  ]) expect(zh).toContain(heading);
  expect((zh.match(/^\$\$$/gm) ?? []).length).toBe((en.match(/^\$\$$/gm) ?? []).length);
  expect((zh.match(/^\|---/gm) ?? []).length).toBe((en.match(/^\|---/gm) ?? []).length);
});

test("the opening distinguishes observation prediction from embodied control", () => {
  for (const phrase of [
    "生成视频、学习得到的模拟器和机器人策略可以共用同一个视觉主干，但它们解决的问题不同",
    "视频生成器预测的是看起来合理的观测",
    "策略负责选择动作，还必须承受动作带来的真实后果",
    "预测合理的观测，不等于预测采取某个动作后会发生什么",
    "模型接受像素，并不是核心问题",
  ]) expect(zh).toContain(phrase);
});

test("generation dynamics planning and control remain separate contracts", () => {
  for (const row of [
    "| 观测生成 | 上下文和提示词 → 未来画面 | 样本看起来来自目标分布 |",
    "| 动力学预测 | 状态和拟议动作 → 下一状态分布 | 模型捕捉到动作条件下的变化 |",
    "| 规划 | 当前状态、目标和动力学 → 候选动作序列 | 搜索在模型中找到高价值路径 |",
    "| 控制策略 | 实时观测和指令 → 动作 | 系统在闭环中完成任务 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("一行成功，并不能证明下一行也会成功");
  expect(zh).toContain("模型会根据观测历史构造与任务有关的状态");
  expect(zh).toContain("没有任何规定要求一种表示服务于所有目标");
});

test("the world-model interface defines state action transition reward and termination", () => {
  for (const formula of [
    String.raw`z_t=e_\phi(o_{1:t})`,
    String.raw`\widehat z_{t+1}=f_\theta(z_t,a_t)`,
    String.raw`(\widehat r_t,\widehat d_t)=h_\psi(z_t,a_t)`,
    String.raw`\mathcal{L}_{\mathrm{dyn}}`,
    String.raw`\operatorname{sg}[e_\phi(o_{1:t+1})]`,
  ]) expect(zh).toContain(formula);
  expect(zh).toContain("规划本身并不要求解码器存在");
  expect(zh).toContain("随机世界模型会用下一状态的分布取代点预测");
  expect(zh).toContain("关键不变量是模型面对的条件问题，尤其是状态转移是否依赖 $a_t$");
  for (const label of [
    'label="观测历史"',
    'label="编码器\\n状态估计 z_t"',
    'label="规划器\\n候选动作"',
    'label="学习到的动力学\\n下一状态和奖励"',
    'label="机器人或环境"',
    'label="可选解码器\\n预测观测"',
  ]) expect(zh).toContain(label);
});

test("visual realism remains weaker than intervention and planning evidence", () => {
  expect(zh).toContain(String.raw`p_\theta(o_{t+1:t+H}\mid o_{1:t},c)`);
  expect(zh).toContain("被动视频记录的是数据采集行为实际产生的结果");
  expect(zh).toContain("更多视频可以扩大覆盖面，但仅靠覆盖面无法识别这些反事实结果");
  expect(zh).toContain("这些结果说明物理规律需要与外观质量分开测试");
  for (const row of [
    "| 感知质量 | 输出在人类和视觉指标看来是否连贯？ |",
    "| 多步预测 | 状态、身份和约束能否随时间保持一致？ |",
    "| 干预测试 | 改变动作时，结果是否发生正确变化？ |",
    "| 规划效用 | 使用该模型能否提高训练场景之外的闭环任务回报？ |",
  ]) expect(zh).toContain(row);
});

test("representation choices preserve downstream decision requirements", () => {
  for (const row of [
    "| 观测空间 | 像素、深度、音频或词元 | 可检查的滚动预测和丰富监督 | 容量耗在不可预测的细节上 |",
    "| 学习得到的潜状态 | 未来预测或奖励所需的特征 | 紧凑的规划与抽象 | 可能丢掉有用的物理变量 |",
    "| 结构化状态 | 物体、位姿、几何、接触或地图 | 持久约束和可解释规划 | 状态提取与结构定义成为瓶颈 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("最合适的表示，是能够保留下游决策所需差异的最小表示");
  expect(zh).toContain("被动视频提供的是表示先验，不是完整控制器");
});

test("planning exposes model error through optimization", () => {
  expect(zh).toContain(String.raw`a^*_{t:t+H-1}`);
  expect(zh).toContain(String.raw`\arg\max_{a_{t:t+H-1}}`);
  expect(zh).toContain(String.raw`\gamma^k\widehat r(z_{t+k},a_{t+k})`);
  expect(zh).toContain("模型预测控制只执行第一个动作或一小段动作前缀");
  expect(zh).toContain("优化会寻找在模型看来格外有利的动作序列");
  expect(zh).toContain("不能只看一步预测损失");
});

test("multimodal fusion remains distinct from an action-conditioned world model", () => {
  expect(zh).toContain("任何一种选择都不会单独创造出世界模型");
  expect(zh).toContain("一个主干可以同时处理文本、图像、音频和视频，却没有动作条件下的状态转移");
  expect(zh).toContain("需要检验的科学主张是迁移效果");
  expect(zh).toContain("仅仅把多种模态放进同一个序列，不能回答这个问题");
});

test("robot policies retain embodiment-specific action and feedback contracts", () => {
  expect(zh).toContain("@gls-vla，也就是在感知语言模型上增加机器人命令策略的模型");
  expect(zh).toContain(String.raw`\pi_\eta(a_{t:t+K-1}\mid o_{1:t},q_t,\ell)`);
  expect(zh).toContain("这些选择无法在不同机器人本体之间直接互换");
  expect(zh).toContain("接触、延迟、标定和动作语义仍然来自具身数据与控制栈");
  expect(zh).toContain("动作分块 Transformer（ACT）一次预测未来 $K$ 个动作");
  expect(zh).toContain("$K$ 表示预测块长度，与重规划间隔和低层控制频率是不同概念");
});

test("control accounting distinguishes commands model calls and predictions", () => {
  expect(zh).toContain(String.raw`N_{\mathrm{ctrl}}=\lceil FD\rceil`);
  expect(zh).toContain(String.raw`N_{\mathrm{model}}`);
  expect(zh).toContain(String.raw`N_{\mathrm{pred}}=K N_{\mathrm{model}}`);
  expect(zh).toContain("这些控制目标彼此相关，不能视作 600 或 3,000 条独立演示");
  const cell = zh.match(/:::: \{\.runnable\}\s*```python\n([\s\S]*?)\n```\s*::::/);
  expect(cell).not.toBeNull();
  const python = Bun.which("python3");
  expect(python).not.toBeNull();
  const run = Bun.spawnSync([python!, "-c", cell![1]], { stdout: "pipe", stderr: "pipe" });
  const stdout = new TextDecoder().decode(run.stdout).trim();
  const stderr = new TextDecoder().decode(run.stderr);
  expect(run.exitCode, stderr).toBe(0);
  expect(stdout.split("\n")).toEqual([
    "实际执行的控制步数：500",
    "大模型调用次数：125",
    "预测动作位置数：2,000",
    "模型调用缩减倍数：4.0",
  ]);
  expect(cell![1]).not.toContain("numpy");
  expect(cell![1]).not.toContain("random");
  expect(zh).toContain("这项核算并不承诺延迟会降低四倍");
});

test("robot data keeps trajectory units and source-specific gaps explicit", () => {
  expect(zh).toContain("无法把语言词元可靠地换算成机器人轨迹");
  expect(zh).toContain("声称机器人数据等于语言数据的某个固定比例，会掩盖这些计量单位");
  expect(zh).toContain("Open X-Embodiment 统一了来自 22 种机器人、21 家机构和 527 项技能的数据");
  expect(zh).toContain("DROID 在 564 个场景中采集了 76,000 条演示，合计约 350 小时");
  for (const row of [
    "| 真实遥操作 | 同步的观测与动作轨迹 | 人力昂贵、需要复位、覆盖有限 |",
    "| 跨本体汇集 | 更多任务和硬件多样性 | 动作空间和传感器标定不兼容 |",
    "| 仿真 | 低成本干预和精确状态 | 外观、接触、磨损和执行器存在偏差 |",
    "| 被动人类视频 | 广泛的物体、环境和行为 | 缺少机器人动作、力、本体感知和本体映射 |",
    "| 学习模型的滚动预测 | 定向生成的合成轨迹 | 继承模型偏差和可被利用的错误 |",
  ]) expect(zh).toContain(row);
});

test("the embodied data loop remains anchored to real closed-loop trials", () => {
  expect(zh).toContain("真正有用的飞轮不是「无限生成机器人数据」");
  expect(zh).toContain("收集一次失败，复现或近似这个失败，更新模型，再回到真实硬件上复测");
  expect(zh).toContain("近乎重复的场景或操作员习惯可能泄漏到数据划分两侧");
  for (const label of [
    'label="遥操作\\n真实动作"',
    'label="仿真\\n低成本干预"',
    'label="被动视频\\n广泛观测"',
    'label="模型滚动预测\\n定向合成"',
    'label="带版本的轨迹混合数据"',
    'label="策略与控制栈"',
    'label="真实闭环试验"',
    'label="失败、干预与安全"',
  ]) expect(zh).toContain(label);
});

test("closed-loop evaluation reports outcomes robustness recovery burden safety and efficiency", () => {
  expect(zh).toContain("离线动作预测是开发指标，不是部署结果");
  for (const row of [
    "| 任务结果 | 完成标准、部分进展、完成时间 |",
    "| 鲁棒性 | 新物体、新布局、新光照、新指令和扰动 |",
    "| 恢复能力 | 人为造成打滑、遮挡或抓取失败后的成功率 |",
    "| 人工负担 | 干预次数、复位次数、遥操作接管时间 |",
    "| 安全 | 接触、力或速度超限、险情、紧急停止 |",
    "| 效率 | 策略延迟、错过控制截止时间、能耗、模型调用次数 |",
  ]) expect(zh).toContain(row);
  expect(zh).toContain("每个比率都必须给出分母和试验协议");
  expect(zh).toContain("真实闭环试验检验整个系统");
});

test("contested questions lower-layer constraints and evidence boundary remain bounded", () => {
  for (const phrase of [
    "被动视频能否识别有用的物理动力学？",
    "世界模型应当保留什么？",
    "网络先验能否迁移到控制？",
    "可以接受多长的开环执行？",
    "哪些合成数据真正有用？",
    "具身系统把模型选择变成截止时间和物理单位",
    "更大的多模态主干无法挽回错过的控制截止时间",
    "超越文本并没有揭示一种名为「接地」的单一缺失成分",
    "它揭示的是一组层层相扣的契约",
    "开放问题是如何在不同环境、任务、机器人本体和干预之间可靠迁移",
  ]) expect(zh).toContain(phrase);
});

test("Chinese Chapter 16 preserves the English artifact and reference contract", () => {
  expect(uniqueMatches(zh, /(@[A-Za-z0-9_-]+)/g)).toEqual(uniqueMatches(en, /(@[A-Za-z0-9_-]+)/g));
  expect(uniqueMatches(zh, /\/figures\/([^\s)]+)/g)).toEqual(uniqueMatches(en, /\/figures\/([^\s)]+)/g));
  expect(uniqueMatches(zh, /\/\/\| label: ([^\n]+)/g)).toEqual(uniqueMatches(en, /\/\/\| label: ([^\n]+)/g));
  expect((zh.match(/:::: \{\.runnable\}/g) ?? []).length).toBe((en.match(/:::: \{\.runnable\}/g) ?? []).length);
});

test("the rewrite removes stale machine-like and unsupported claims", () => {
  for (const rejected of [
    "文本内部有一个数据上限",
    "早期证据更支持后一种读法",
    "更多是由现成数据支撑起来的",
    "性质上属于认识论，而非工程",
    "加数据、加参数换不来规划",
    "世界模型是什么」的三条路线",
    "生成式像素空间",
    "机器人没有互联网",
    "约为文本的 1/200,000",
    "构造动作数据循环的四种办法",
    "还没有可靠的度量",
    "缺失的数据循环",
    "证据偏向怀疑者",
    "@deepmind2025geminirobotics",
    "@deepmind2025genie3",
    "@gen02025",
    "@liu2025soracost",
    "@pi2025pi05",
    "@sec-benchmarks",
    "@sec-evaluating-agents",
    "@sec-faster-decoding",
    "@sec-learning-limits",
    "@sec-multimodal",
    "@sec-scaling-laws",
    "@sec-training-to-reason",
    "@vlasurvey2025",
    "—",
  ]) expect(zh).not.toContain(rejected);
});

test("both localized Graphviz figures are readable inside the mobile column", async () => {
  const blocks = [...zh.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(2);
  const graphviz = await loadGraphviz();
  for (const block of blocks) {
    expect(block[1]).toContain("rankdir=TB;");
    expect(block[1]).not.toContain("rankdir=LR;");
    const html = renderDot(graphviz, block[1], new Map(), "generative/beyond-text.html", "");
    const widthPt = Number(html.match(/<svg[^>]* width="([\d.]+)pt"/)?.[1]);
    expect(widthPt).toBeGreaterThanOrEqual(180);
    expect(widthPt).toBeLessThanOrEqual(235);
  }
});
