import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "bun:test";

const zhRoot = join(import.meta.dir, "..", "..", "zh");
const repoRoot = join(import.meta.dir, "..", "..");
const enRoot = join(repoRoot, "en");
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

test("polished prose avoids loose trick and scaffold calques", () => {
  const enOffenders = qmdFiles(enRoot).filter((path) =>
    /\btricks?\b/i.test(readFileSync(path, "utf8")),
  );
  const zhOffenders = qmdFiles(zhRoot).filter((path) =>
    /诀窍|脚手架/.test(readFileSync(path, "utf8")),
  );

  expect(enOffenders.map((path) => path.replace(enRoot + "/", ""))).toEqual([]);
  expect(zhOffenders.map((path) => path.replace(zhRoot + "/", ""))).toEqual([]);
});

test("zh introductory prose avoids abrupt bridges and stiff commitment framing", () => {
  const preface = readFileSync(join(repoRoot, "zh/index.qmd"), "utf8");
  const orientation = readFileSync(join(repoRoot, "zh/orientation/index.qmd"), "utf8");

  expect(preface).toContain("本书只取它的工程后果");
  expect(preface).not.toContain("它是一串承诺");
  expect(preface).not.toContain("能不能被信任、负担");
  expect(orientation).toContain("为了让这种读法不散，每章都会提供三类路标");
  expect(orientation).not.toContain("三个习惯让这种读法成立");

  const zhText = qmdFiles(zhRoot)
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");
  expect(zhText).not.toContain("三个事实让这套在实践中成立");
  expect(zhText).not.toContain("三份契约重要，是因为");
  expect(zhText).not.toContain("这点重要，是因为");
  expect(zhText).not.toContain("这个问题重要，是因为");
  expect(zhText).not.toContain("训练和服务在这里重要，是因为");
  expect(zhText).not.toContain("问题在于，当调用方变成智能体时");
  expect(zhText).not.toContain("真正的问题是：既然算力是稀缺的输入");
  expect(zhText).not.toContain("有三个约束让这个问题变难");
});

test("zh orientation prose avoids literal or note-like formulations", () => {
  const orientationText = qmdFiles(join(zhRoot, "orientation"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  expect(orientationText).not.toContain("本书确实假设、而非从零教起的一个前提是");
  expect(orientationText).not.toContain("不会从零教起的前提");
  expect(orientationText).not.toContain("第一段大规模相位");
  expect(orientationText).not.toContain("偏好下方的数据制度");
  expect(orientationText).not.toContain("从图中看出这三种付费节奏");
  expect(orientationText).not.toContain("用一个动作形式化了");
  expect(orientationText).not.toContain("与源头的分岔精确且可定位");
  expect(orientationText).not.toContain("把它们读作不止一幅图");
  expect(orientationText).not.toContain("被症状没有点名的那一层");
});

test("zh foundation prose avoids literal or note-like formulations", () => {
  const foundationsText = qmdFiles(join(zhRoot, "foundations"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  expect(foundationsText).not.toContain("从预报走到执行");
  expect(foundationsText).not.toContain("先把它预报出来");
  expect(foundationsText).not.toContain("一梯廉价的小规模训练");
  expect(foundationsText).not.toContain("从预报训练转为执行训练");
  expect(foundationsText).not.toContain("让它不只是管道工程的，是");
  expect(foundationsText).not.toContain("那件人造物才是关键");
  expect(foundationsText).not.toContain("评估那边提供的");
  expect(foundationsText).not.toContain("带着这些契约往下看");
  expect(foundationsText).not.toContain("该保护哪些留出集");
  expect(foundationsText).not.toContain("不提供需要保护哪些留出集");
  expect(foundationsText).not.toContain("读这个块要读两遍");
  expect(foundationsText).not.toContain("三个已有定论的问题");
  expect(foundationsText).not.toContain("位置是第三个");
  expect(foundationsText).not.toContain("这一个事实");
  expect(foundationsText).not.toContain("上述选择做定");
  expect(foundationsText).not.toContain("路由器单凭自己最先出问题");
  expect(foundationsText).not.toContain("路由器是必须做对的那一块");
  expect(foundationsText).not.toContain("得分上一个微小的变化");
  expect(foundationsText).not.toContain("召回才是那个坎");
  expect(foundationsText).not.toContain("包罗万象的总目");
  expect(foundationsText).not.toContain("有一个容错关切");
  expect(foundationsText).not.toContain("对上一个流式处理分数的内核");
  expect(foundationsText).not.toContain("一个流式处理分数的内核，则");
  expect(foundationsText).not.toContain("训练序列里的相位");
  expect(foundationsText).not.toContain("数学底材");
});

test("zh generative prose avoids literal or note-like formulations", () => {
  const generativeText = qmdFiles(join(zhRoot, "generative"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  expect(generativeText).not.toContain("一条其长度即输出长度的串行链");
  expect(generativeText).not.toContain("其化解是条件流匹配目标");
  expect(generativeText).not.toContain("下面这些设计，在很大程度上就是对它的四种不同回答");
  expect(generativeText).not.toContain("本章余下的，正是这个领域明确这层联系之后所发生的事");
  expect(generativeText).not.toContain("应该谨慎来读");
  expect(generativeText).not.toContain("应当谨慎读");
  expect(generativeText).not.toContain("实时语音界面只有几百毫秒");
  expect(generativeText).not.toContain("这些损失所坐落的编码器");
  expect(generativeText).not.toContain("流匹配施于语音");
  expect(generativeText).not.toContain("搭着文本模型的进步");
  expect(generativeText).not.toContain("扩散模型条件在文本上");
  expect(generativeText).not.toContain("自回归路线，则是");
  expect(generativeText).not.toContain("世界模型是什么」的三个答案");
  expect(generativeText).not.toContain("这个领域分化出三个架构上的答案");
  expect(generativeText).not.toContain("第一个答案是继续生成世界");
  expect(generativeText).not.toContain("读完这一部分，读者应");
});

test("zh adaptation prose avoids literal or note-like formulations", () => {
  const adaptationText = qmdFiles(join(zhRoot, "adaptation"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  expect(adaptationText).not.toContain("补上这道差距");
  expect(adaptationText).not.toContain("有一个想法贯穿这里的约束");
  expect(adaptationText).not.toContain("从这些比较已经存在之处开始");
  expect(adaptationText).not.toContain("本章余下部分讨论的");
  expect(adaptationText).not.toContain("从另一端得到一个对齐好的模型");
  expect(adaptationText).not.toContain("同时让四个模型在场");
  expect(adaptationText).not.toContain("一旦这个损失存在");
  expect(adaptationText).not.toContain("前一行损失所携带");
  expect(adaptationText).not.toContain("那别的东西，就是流水线");
  expect(adaptationText).not.toContain("通向第四部分的铰链");
  expect(adaptationText).not.toContain("通过时取一");
  expect(adaptationText).not.toContain("运行时系统看到请求之前");
  expect(adaptationText).not.toContain("模型行为的第一道线");
  expect(adaptationText).not.toContain("答案有四个，而且");
  expect(adaptationText).not.toContain("同一个问题的四个答案");
  expect(adaptationText).not.toContain("在四个答案之前");
  expect(adaptationText).not.toContain("一个第一次未必能可靠给出正确答案的模型");
  expect(adaptationText).not.toContain("一个小而精选过滤的集合");
  expect(adaptationText).not.toContain("在验证器是一个习得的");
  expect(adaptationText).not.toContain("走过四个答案");
  expect(adaptationText).not.toContain("这界限很紧");
  expect(adaptationText).not.toContain("这界限宽松");
  expect(adaptationText).not.toContain("反对角线");
  expect(adaptationText).not.toContain("同一个变量的四种绑定");
});

test("zh reasoning prose avoids literal or note-like formulations", () => {
  const reasoningText = qmdFiles(join(zhRoot, "reasoning"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  expect(reasoningText).not.toContain("换一种读法");
  expect(reasoningText).not.toContain("再不依赖它的单个样本");
  expect(reasoningText).not.toContain("四种形态");
  expect(reasoningText).not.toContain("诸条推理路径积分掉");
  expect(reasoningText).not.toContain("在一片部分解的空间上做搜索");
  expect(reasoningText).not.toContain("循步指令");
  expect(reasoningText).not.toContain("彼此竞争");
  expect(reasoningText).not.toContain("值得得到下一份算力");
  expect(reasoningText).not.toContain("中间 thought");
  expect(reasoningText).not.toContain("thought 背后");
  expect(reasoningText).not.toContain("短 thought");
  expect(reasoningText).not.toContain("早先 thought");
  expect(reasoningText).not.toContain("反馈把手");
  expect(reasoningText).not.toContain("每一种回答的问题都不同");
  expect(reasoningText).not.toContain("credit 的单位");
  expect(reasoningText).not.toContain("章节之间的铰链");
  expect(reasoningText).not.toContain("一个单一的对象");
  expect(reasoningText).not.toContain("这个对象被固定");
  expect(reasoningText).not.toContain("激发这一切的失效");
  expect(reasoningText).not.toContain("展开这个对象");
  expect(reasoningText).not.toContain("则是展示了");
  expect(reasoningText).not.toContain("这一对照承载了它的主张");
  expect(reasoningText).not.toContain("奖励给谁");
  expect(reasoningText).not.toContain("监督这个问题有它自己的脉络");
  expect(reasoningText).not.toContain("组基线偏在何处");
  expect(reasoningText).not.toContain("行为捐给");
  expect(reasoningText).not.toContain("自改进推理数据形式");
  expect(reasoningText).not.toContain("生产端问题提供了答案");
  expect(reasoningText).not.toContain("这个界限并非脚注");
  expect(reasoningText).not.toContain("放它的地方");
  expect(reasoningText).not.toContain("核心的那个");
  expect(reasoningText).not.toContain("控制问题来读");
  expect(reasoningText).not.toContain("内部器官");
});

test("zh inference prose avoids literal or note-like formulations", () => {
  const inferenceText = qmdFiles(join(zhRoot, "inference"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  expect(inferenceText).not.toContain("本章沿着这个资源展开");
  expect(inferenceText).not.toContain("一个问题的两个事实");
  expect(inferenceText).not.toContain("显存这一面的事实是");
  expect(inferenceText).not.toContain("调度这一面的事实是");
  expect(inferenceText).not.toContain("所以问题分两半");
  expect(inferenceText).not.toContain("同一个基本动作");
  expect(inferenceText).not.toContain("下文围绕两个问题展开");
  expect(inferenceText).not.toContain("这份收益画得具体");
  expect(inferenceText).not.toContain("最好读作");
  expect(inferenceText).not.toContain("这条演化线索");
  expect(inferenceText).not.toContain("这道交易之下");
  expect(inferenceText).not.toContain("从瓶颈读出情形");
  expect(inferenceText).not.toContain("两个前几章没有解决的诉求");
  expect(inferenceText).not.toContain("两条演化线索并置");
  expect(inferenceText).not.toContain("两条线索汇于同一处");
  expect(inferenceText).not.toContain("这两项机制把本章分成");
  expect(inferenceText).not.toContain("分词器从未造出的那个 token");
  expect(inferenceText).not.toContain("第一根是基础网格");
  expect(inferenceText).not.toContain("第二根是切片");
  expect(inferenceText).not.toContain("第三根是动态分辨率");
  expect(inferenceText).not.toContain("读完这一部分");
});

test("zh orchestration prose avoids literal or note-like formulations", () => {
  const orchestrationText = qmdFiles(join(zhRoot, "orchestration"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  expect(orchestrationText).not.toContain("有三条约束，会左右对这道缝隙给出的任何答案");
  expect(orchestrationText).not.toContain("这里管架构，那里管工程");
  expect(orchestrationText).not.toContain("把工具使用定了性");
  expect(orchestrationText).not.toContain("推理这一侧也在长进");
  expect(orchestrationText).not.toContain("挪到了循环底下");
  expect(orchestrationText).not.toContain("工具就那么精挑的几个");
  expect(orchestrationText).not.toContain("所有的难处，都藏在");
  expect(orchestrationText).not.toContain("半点不饶人");
  expect(orchestrationText).not.toContain("对着这个问题排开来看");
  expect(orchestrationText).not.toContain("小契约横跨这三者");
  expect(orchestrationText).not.toContain("远谈不上统一的状态形态");
  expect(orchestrationText).not.toContain("分支在对话上分得便宜");
  expect(orchestrationText).not.toContain("记忆拒绝保证什么");
  expect(orchestrationText).not.toContain("痛苦的那个情形");
  expect(orchestrationText).not.toContain("稀松平常");
  expect(orchestrationText).not.toContain("最具分量的那个机制");
  expect(orchestrationText).not.toContain("只是作戏");
  expect(orchestrationText).not.toContain("锁有两个直接来自锁定文献的坑");
  expect(orchestrationText).not.toContain("为何承重");
  expect(orchestrationText).not.toContain("从运行框架的座位上看");
  expect(orchestrationText).not.toContain("承重的问题");
  expect(orchestrationText).not.toContain("把编排整个颠倒了过来");
  expect(orchestrationText).not.toContain("这条演化线索从汇集走向结构");
  expect(orchestrationText).not.toContain("这条弧线的现代终点");
  expect(orchestrationText).not.toContain("源材料对那些尚未定论之处不加掩饰的地方");
  expect(orchestrationText).not.toContain("由此落出的协议很小");
  expect(orchestrationText).not.toContain("第三步是对第二步的推广");
  expect(orchestrationText).not.toContain("上下文窗口涨向");
  expect(orchestrationText).not.toContain("要紧地估出");
  expect(orchestrationText).not.toContain("同一个控制参数还在与自己较劲");
  expect(orchestrationText).not.toContain("这堵墙");
  expect(orchestrationText).not.toContain("ColBERT 占着中间");
  expect(orchestrationText).not.toContain("本事在于推开什么");
  expect(orchestrationText).not.toContain("收成一个由提示参数化的模型");
  expect(orchestrationText).not.toContain("跨着这些线索是一致的");
});

test("zh evaluation prose avoids literal or note-like formulations", () => {
  const evaluationText = qmdFiles(join(zhRoot, "evaluation"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  expect(evaluationText).not.toContain("这条演进线索，从");
  expect(evaluationText).not.toContain("从这条线索里引出两个权衡");
  expect(evaluationText).not.toContain("这里真正关键的是「审计」");
  expect(evaluationText).not.toContain("凡此种种，正是为什么");
  expect(evaluationText).not.toContain("测量的那件事");
  expect(evaluationText).not.toContain("单独隔离出来的那件事");
  expect(evaluationText).not.toContain("评判者提示就是被编码成评测程序");
  expect(evaluationText).not.toContain("没有哪种格式天然是金标准");
  expect(evaluationText).not.toContain("格式只相对于它支撑的主张成立");
  expect(evaluationText).not.toContain("可信的单位不是");
  expect(evaluationText).not.toContain("这份真值里人的那一侧");
  expect(evaluationText).not.toContain("把这件事推到了开放规模");
  expect(evaluationText).not.toContain("它的输入新鲜");
  expect(evaluationText).not.toContain("这条教训把留出原则");
  expect(evaluationText).not.toContain("## 选择立足之处");
  expect(evaluationText).not.toContain("第三，就是那笔退款本身");
  expect(evaluationText).not.toContain("这里要紧的是它们的共同点");
  expect(evaluationText).not.toContain("多模态评测位在这条边界上");
  expect(evaluationText).not.toContain("这个判断有名字");
  expect(evaluationText).not.toContain("第一直觉是多跑几个再聚合");
  expect(evaluationText).not.toContain("更深的一步，是不要再把分歧当噪声");
  expect(evaluationText).not.toContain("这跟评判智能体的结果而非路径是同一个形状");
  expect(evaluationText).not.toContain("那条下层事实，即共享权重意味着相关失败");
  expect(evaluationText).not.toContain("在评估层不是偏好问题");
  expect(evaluationText).not.toContain("就是全部论证所在");
  expect(evaluationText).not.toContain("这个乘积是小组能达到的最好情形");
  expect(evaluationText).not.toContain("这个乘积只有在");
  expect(evaluationText).not.toContain("分道之处");
  expect(evaluationText).not.toContain("那正是真正需要人来判断");
});

test("zh safety prose avoids literal or note-like formulations", () => {
  const safetyText = qmdFiles(join(zhRoot, "safety"))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  expect(safetyText).not.toContain("出事后谁负责");
  expect(safetyText).not.toContain("真正要看的，是");
  expect(safetyText).not.toContain("走到这一步，领域才真正面对那个公开问题");
  expect(safetyText).not.toContain("这条路线从手工追踪");
  expect(safetyText).not.toContain("## 稀疏自编码器的审判");
  expect(safetyText).not.toContain("这轮方法演进");
  expect(safetyText).not.toContain("那场审判");
  expect(safetyText).not.toContain("一个问题的两种哲学");
  expect(safetyText).not.toContain("这条分界决定了后面的顺序");
  expect(safetyText).not.toContain("给问题命名的那次入侵");
  expect(safetyText).not.toContain("这句话给问题定了形");
  expect(safetyText).not.toContain("每一个都是这样一处地方");
  expect(safetyText).not.toContain("真正回答「这个调用方可否");
  expect(safetyText).not.toContain("这条脉络从粗陋走向可编程");
  expect(safetyText).not.toContain("那个决定性的转变");
  expect(safetyText).not.toContain("运行时安全最难的那一例");
  expect(safetyText).not.toContain("危险的那一例是间接注入");
  expect(safetyText).not.toContain("那个输出分类器");
  expect(safetyText).not.toContain("这一时期令人不安的发现是");
  expect(safetyText).not.toContain("这个指标是攻击成功率");
  expect(safetyText).not.toContain("那个判定何为有害的裁判");
  expect(safetyText).not.toContain("自动化所做的，是");
  expect(safetyText).not.toContain("也受这件事限制");
  expect(safetyText).not.toContain("那个有动机的对手");
  expect(safetyText).not.toContain("信任才是全部要点");
  expect(safetyText).not.toContain("这一层令人不适的论点是");
});

test("polished chapter openings preserve key source theses", () => {
  const checks: Array<[string, string[]]> = [
    [
      "en/index.qmd",
      ["one capability through its lifecycle", "deployed behavior that can be measured, constrained, and operated", "why the mechanism took this shape"],
    ],
    [
      "zh/index.qmd",
      ["一项能力如何从原始算力和语料构造出发", "可度量、可约束、可运维的部署行为", "为什么长成这个样子"],
    ],
    [
      "en/orientation/index.qmd",
      ["route through the stack is visible", "live claims are separated from settled ground", "borrowed vocabulary"],
    ],
    [
      "zh/orientation/index.qmd",
      ["请求穿过全栈的路线", "区分定论和争议的地图", "处理借来词汇的分寸"],
    ],
    [
      "en/foundations/01-scaling-laws.qmd",
      ["Kaplan-era parameter-heavy", "Chinchilla-style data allocation", "inference-aware"],
    ],
    [
      "zh/foundations/01-scaling-laws.qmd",
      ["Kaplan 时代偏向参数", "Chinchilla 式的数据分配", "推断感知的过度训练"],
    ],
    [
      "en/foundations/index.qmd",
      ["later freedoms are bought", "later constraints are locked in", "Serving, adaptation, evaluation, and safety all inherit"],
    ],
    [
      "zh/foundations/index.qmd",
      ["训练预算有多大", "语料从哪里来", "以后还能改", "已经成为模型的一部分"],
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
      ["路由器", "以很低的每词元计算成本增长", "专家不能长期拿不到训练信号"],
    ],
    [
      "en/foundations/07-mid-training.qmd",
      ["distributional bridge", "Quality annealing", "Long-context mid-training"],
    ],
    [
      "zh/foundations/07-mid-training.qmd",
      ["分布桥接", "质量退火", "长上下文中段训练"],
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
      ["自回归教师", "离散扩散", "2025 年出现的一批"],
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
      "en/generative/index.qmd",
      ["not naturally a left-to-right string", "world models, robotics, and embodiment", "invented order is the architecture"],
    ],
    [
      "zh/generative/index.qmd",
      ["并不天然是一条从左到右的字符串", "世界模型、机器人和具身系统", "系统为训练和采样构造了怎样的顺序"],
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
      "en/adaptation/02-behavior-specs-preference-data.qmd",
      ["behavior specification", "preference data", "annotators", "AI feedback", "weighted judgment"],
    ],
    [
      "zh/adaptation/02-behavior-specs-preference-data.qmd",
      ["行为规格", "偏好数据", "标注者", "AI 反馈", "带权判断"],
    ],
    [
      "en/adaptation/03-rlhf-reward-modeling.qmd",
      ["train a reward model on human", "comparisons", "optimize a policy against that reward with @gls-ppo", "constitutional and @gls-rlaif variants", "learned reward needs a KL constraint"],
    ],
    [
      "zh/adaptation/03-rlhf-reward-modeling.qmd",
      ["人类比较上训练一个奖励模型", "用 @gls-ppo 针对这个奖励优化策略", "宪法式方法与", "@gls-rlaif 变体", "习得奖励需要 KL 约束"],
    ],
    [
      "en/adaptation/04-dpo-variants.qmd",
      ["collapses the", "apparatus into a single classification loss", "language model is an implicit reward model", "none of the variants reliably", "beats the plain loss", "pipeline and data constraints"],
    ],
    [
      "zh/adaptation/04-dpo-variants.qmd",
      ["化约为一个分类损失", "语言模型隐式地就是一个奖励模型", "没有哪个变体能可靠地胜过", "基础 DPO 损失", "流水线与数据约束"],
    ],
    [
      "en/adaptation/05-verifiable-rewards-reasoning.qmd",
      ["verifiable reward", "unit test", "RLVR", "Outcome rewards", "process rewards"],
    ],
    [
      "zh/adaptation/05-verifiable-rewards-reasoning.qmd",
      ["可验证奖励", "单元测试", "RLVR", "结果奖励", "过程奖励"],
    ],
    [
      "en/adaptation/06-safety-tuning-instruction-hierarchy.qmd",
      ["Safety tuning", "instruction hierarchy", "Deliberative Alignment", "Refusal calibration", "runtime safety"],
    ],
    [
      "zh/adaptation/06-safety-tuning-instruction-hierarchy.qmd",
      ["安全调优", "指令层级", "Deliberative Alignment", "拒绝校准", "运行时安全"],
    ],
    [
      "en/adaptation/07-synthetic-data-self-improvement.qmd",
      ["fresh human labels stop scaling", "a stronger model, the model's own", "filtered outputs", "critic, or a verifier", "data flywheel", "bounded by the quality of the judge"],
    ],
    [
      "zh/adaptation/07-synthetic-data-self-improvement.qmd",
      ["训练信号就必须来自别处", "数据飞轮", "每个回路都有自己的上限", "受判断者质量所界定"],
    ],
    [
      "en/adaptation/index.qmd",
      ["capability by itself is not a usable interface", "behavior specifications", "checkable ones", "trust in the signal"],
    ],
    [
      "zh/adaptation/index.qmd",
      ["能力还需要被指向、约束、排序、检验", "行为规格", "习得奖励与可核查奖励", "信号是否可靠"],
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
      "en/reasoning/02-structured-reasoning-search.qmd",
      ["State Space", "Chains, Beams, Trees", "Value Guidance", "Search Layer"],
    ],
    [
      "zh/reasoning/02-structured-reasoning-search.qmd",
      ["状态空间", "链、束、树与图", "价值引导", "搜索层"],
    ],
    [
      "en/reasoning/03-programs-solvers-symbolic.qmd",
      ["Translation Is the Learned Part", "Faithfulness by Construction", "Runtime Becomes Part", "Failure Moves to the Interface"],
    ],
    [
      "zh/reasoning/03-programs-solvers-symbolic.qmd",
      ["翻译才是学习到的部分", "由构造得到的忠实性", "运行时成为推理器的一部分", "失败移动到了接口处"],
    ],
    [
      "en/reasoning/04-verifiers-process-supervision.qmd",
      ["Outcome, Process", "Verifier Ladder", "Generative Verifiers", "Checker Becomes the Objective"],
    ],
    [
      "zh/reasoning/04-verifiers-process-supervision.qmd",
      ["结果、过程", "验证器阶梯", "生成式验证器", "检查器变成目标"],
    ],
    [
      "en/reasoning/05-training-to-reason.qmd",
      ["checkable ground", "truth rather than a learned human-preference proxy", "removes the learned proxy gap", "dropping the critic", "long-horizon reasoning can emerge", "reweights what the base model could already sample"],
    ],
    [
      "zh/reasoning/05-training-to-reason.qmd",
      ["可核查的真值", "移除了习得代理缺口", "丢掉了评论者", "没有步级监督也能产出长程推理", "重加权了基座模型本来就能采样到的路径"],
    ],
    [
      "en/reasoning/06-reasoning-data-distillation.qmd",
      ["reasoning example", "Bootstrapping", "Small Data", "Distilling Long Thought"],
    ],
    [
      "zh/reasoning/06-reasoning-data-distillation.qmd",
      ["推理样本", "自举与拒绝采样", "小数据", "长思考蒸馏"],
    ],
    [
      "en/reasoning/07-inference-time-scaling.qmd",
      ["Repeated sampling buys coverage but not an answer", "sequential", "revision and parallel search", "compute-optimal allocation routes a budget", "selector is imperfect"],
    ],
    [
      "zh/reasoning/07-inference-time-scaling.qmd",
      ["重复采样提高的是覆盖率，而不是答案质量", "串行修订与并行搜索", "计算最优分配按问题难度调度预算", "选择器并不完美"],
    ],
    [
      "en/reasoning/index.qmd",
      ["spending computation before the answer is fixed", "where is the extra work paid for", "who checks it"],
    ],
    [
      "zh/reasoning/index.qmd",
      ["答案确定之前额外投入的计算", "额外计算投入在哪里", "谁在检查它"],
    ],
    [
      "en/orchestration/01-training-agents-to-act.qmd",
      ["rollout is now the agent's full interaction", "masking the environment's tokens out of the loss", "credit assignment over a long trajectory", "environment becomes a training asset", "training run now", "contains a serving engine"],
    ],
    [
      "zh/orchestration/01-training-agents-to-act.qmd",
      ["rollout 如今是智能体与环境的完整交互", "把环境的词元从损失中屏蔽出去", "长轨迹上的信用分配", "环境本身成了一项训练资产", "内含一个服务引擎"],
    ],
    [
      "en/orchestration/02-agent-architectures.qmd",
      ["planning, memory, tool use", "interleaves reasoning with action", "last action revealed", "turns a text", "generator into something that changes the world"],
    ],
    [
      "zh/orchestration/02-agent-architectures.qmd",
      ["规划、记忆、工具使用", "把推理和行动交织起来", "上一步行动暴露出的事实", "让一个文本生成器真正改变世界"],
    ],
    [
      "en/orchestration/03-memory-systems.qmd",
      ["durable record of a session", "Session logs must record intent", "branching a conversation is cheap", "shared vector store is a data-breach risk"],
    ],
    [
      "zh/orchestration/03-memory-systems.qmd",
      ["一次会话的持久记录", "会话日志必须把意图和结果分开记", "给对话开分支便宜", "共享向量存储是数据泄露风险"],
    ],
    [
      "en/orchestration/04-the-harness.qmd",
      ["runtime around the model", "pause, redirect, fork, or kill", "move an evaluation score as much as a model swap"],
    ],
    [
      "zh/orchestration/04-the-harness.qmd",
      ["模型周围的运行时层", "暂停、重定向、分叉", "评估分数的影响也不亚于一次模型更换"],
    ],
    [
      "en/orchestration/05-multi-agent-systems.qmd",
      ["Voting among similar agents buys less", "structured disagreement buys", "liveness failures", "safety failures", "escalates recoverable failures", "blocks silent ones"],
    ],
    [
      "zh/orchestration/05-multi-agent-systems.qmd",
      ["相似智能体之间的投票", "结构化的分歧", "活性失败", "安全性失败", "升级那些可恢复", "阻断那些会静默发布"],
    ],
    [
      "en/orchestration/06-rag-retrieval.qmd",
      ["question into a few hundred tokens of evidence", "chunk and index", "embed the query", "retrieve and fuse", "context window that keeps growing"],
    ],
    [
      "zh/orchestration/06-rag-retrieval.qmd",
      ["把一个问题变成几百个证据词元", "分块并索引", "嵌入查询", "检索并融合候选", "不断增长的上下文窗口"],
    ],
    [
      "en/orchestration/07-embeddings-representation.qmd",
      ["generator's hidden states make a poor metric space", "alignment against uniformity", "query-document interaction", "negatives are the central training variable", "web-mined pairs", "decoder itself becoming the embedder"],
    ],
    [
      "zh/orchestration/07-embeddings-representation.qmd",
      ["生成器的隐藏状态不适合作为度量空间", "对齐与均匀", "查询与文档交互的位置", "负样本的选择是核心训练变量", "网上挖掘文本对", "解码器即嵌入器"],
    ],
    [
      "en/orchestration/08-context-engineering.qmd",
      ["prompt engineering to context engineering", "longer context window does not by itself solve", "token budgets", "tool protocols", "agent can actually do"],
    ],
    [
      "zh/orchestration/08-context-engineering.qmd",
      ["从提示工程改名为上下文工程", "更长的上下文窗口并不能单凭自身解决问题", "词元预算", "工具协议", "智能体实际能做什么"],
    ],
    [
      "en/orchestration/index.qmd",
      ["unit of work becomes a task", "which loop owns the next decision", "what state it can see", "what can stop it"],
    ],
    [
      "zh/orchestration/index.qmd",
      ["工作单位从 completion 变成 task", "谁拥有下一步决策", "状态存在哪里", "在哪里能被打断"],
    ],
    [
      "en/evaluation/index.qmd",
      ["Evaluation is therefore part of the system", "which numbers deserve to move a decision", "which should only open an investigation"],
    ],
    [
      "zh/evaluation/index.qmd",
      ["评测看起来像结尾处的打分", "而把它当作系统的一部分来读", "哪些数字足以推动决策"],
    ],
    [
      "en/evaluation/01-benchmarks.qmd",
      ["published benchmark score is never a fact about a model alone", "@gls-held-out is a pipeline contract", "@gls-contamination silently inflates numbers", "harness, data contract, and uncertainty"],
    ],
    [
      "zh/evaluation/01-benchmarks.qmd",
      ["基准分数，从来不是关于模型本身的事实", "@gls-held-out 是一份流水线契约", "@gls-contamination会不声不响地推高数字", "框架、数据契约与不确定性"],
    ],
    [
      "en/evaluation/02-statistical-reliability.qmd",
      ["A benchmark score is an estimate, not a fact", "Compare on the Same Items", "Many Looks Create False Wins", "Bias Is Not Noise"],
    ],
    [
      "zh/evaluation/02-statistical-reliability.qmd",
      ["一个基准分数是估计值，不是事实", "在同一批项目上比较", "看得越多，假胜利越多", "偏差不是噪声"],
    ],
    [
      "en/evaluation/03-human-evaluation-rubrics.qmd",
      ["The human label is not a primitive", "The Protocol Creates the Label", "Rubrics Are Interfaces for Judgment", "Agreement Is a Property to Measure"],
    ],
    [
      "zh/evaluation/03-human-evaluation-rubrics.qmd",
      ["人类标签不是原子事实", "协议创造了标签", "评分准则是判断的界面", "一致性也要被测量"],
    ],
    [
      "en/evaluation/04-judging-holistic.qmd",
      ["@gls-llm-as-judge is biased", "arena-style preference ranking", "@gls-pairwise-comparison votes into a single number", "private test set is worth more"],
    ],
    [
      "zh/evaluation/04-judging-holistic.qmd",
      ["@gls-llm-as-judge会产生偏差", "竞技场式的偏好排名", "@gls-pairwise-comparison汇成单一数字", "私有测试集也因此比公开排行榜更有价值"],
    ],
    [
      "en/evaluation/05-factuality-grounding.qmd",
      ["Four Words That Should Not Collapse", "From Answer to Claims", "Short Answers and Abstention", "Grounding in Retrieval Systems"],
    ],
    [
      "zh/evaluation/05-factuality-grounding.qmd",
      ["四个词不能混成一个", "从回答到 claim", "短答案与弃答", "检索系统里的 grounding"],
    ],
    [
      "en/evaluation/06-evaluating-agents.qmd",
      ["agent score is a property of model-plus-harness", "graded on its outcome rather than its path", "built to disagree with the agent", "independent, checkable signal beats a self-report"],
    ],
    [
      "zh/evaluation/06-evaluating-agents.qmd",
      ["智能体分数衡量的是「模型加运行框架」", "按结果而非路径来评分", "与智能体保持对抗", "独立、可核查的信号，胜过一份自我报告"],
    ],
    [
      "en/evaluation/07-operational-evaluation.qmd",
      ["The Release Gate Is a Policy", "The Private Suite Is an Asset", "Drift Is Not One Thing", "Quality Is Not the Only Axis"],
    ],
    [
      "zh/evaluation/07-operational-evaluation.qmd",
      ["发布门禁是一条策略", "私有套件是一项资产", "漂移不止一种", "质量不是唯一轴"],
    ],
    [
      "en/safety/01-mechanistic-interpretability.qmd",
      ["trained transformer is a few hundred billion numbers", "single neuron rarely means one thing", "sparse dictionaries", "pulling features apart", "whether that tool is the right one is still open"],
    ],
    [
      "zh/safety/01-mechanistic-interpretability.qmd",
      ["几千亿个数字", "单个神经元很少只意味一件事", "稀疏字典", "拆开特征", "工具是否正确"],
    ],
    [
      "en/safety/02-scalable-oversight-control.qmd",
      ["human judgment has an expiry date", "weaker teacher", "strong model", "bounding the damage", "capability gap"],
    ],
    [
      "zh/safety/02-scalable-oversight-control.qmd",
      ["人类判断之上的对齐有一个有效期限", "弱教师", "强模型", "危害设定上界", "能力差距"],
    ],
    [
      "en/safety/03-security-authorization.qmd",
      ["agent acts in the world with someone's authority", "standing broad token plus a @gls-prompt-injection equals a breach", "Identity and governance split", "downstream of a verified principal"],
    ],
    [
      "zh/safety/03-security-authorization.qmd",
      ["带着某人的授权在世界里行动", "长期存在的宽泛令牌，加上一次@gls-prompt-injection，就等于一次入侵", "身份与治理", "经过验证的主体的下游"],
    ],
    [
      "en/safety/04-runtime-safety.qmd",
      ["aligned model's own refusal is necessary but not sufficient", "input and output have to be screened separately", "policy-conditioned classifiers", "indirect @gls-prompt-injection", "streaming decision reaches up"],
    ],
    [
      "zh/safety/04-runtime-safety.qmd",
      ["已对齐模型自己的拒绝必要但不充分", "输入与输出要分开筛", "由策略条件化的分类器", "间接@gls-prompt-injection", "流式决策会反过来约束护栏设计"],
    ],
    [
      "en/safety/05-adversarial-robustness.qmd",
      ["four families of @gls-jailbreak", "@gls-red-teaming is a measurement discipline", "every known defense is partial", "@gls-adversarial-robustness is a property of the system rather than of the model alone"],
    ],
    [
      "zh/safety/05-adversarial-robustness.qmd",
      ["@gls-jailbreak攻击的四个家族", "@gls-red-teaming是一项度量工作", "每一种已知防御都是局部的", "@gls-adversarial-robustness从结构上说是系统的属性"],
    ],
    [
      "en/safety/06-privacy-provenance-unlearning.qmd",
      ["lossy compression of its training set", "leaks at serving time what it absorbed at training time", "upstream or in a retraining run rather than at the output", "@gls-machine-unlearning can and cannot promise", "Memorization is not a bug layered on top of learning"],
    ],
    [
      "zh/safety/06-privacy-provenance-unlearning.qmd",
      ["训练集的一次有损压缩", "服务时泄露它在训练时吸收的内容", "上游或一次重训练里，而不是输出端", "@gls-machine-unlearning能承诺什么、不能承诺什么", "记忆不是学习之外额外叠上的 bug"],
    ],
    [
      "en/safety/07-law-regulation-policy.qmd",
      ["European Union's risk tiers", "documents a release now legally requires", "copyright is the unsettled ground", "rule written by a regulator rewrite a data-curation decision"],
    ],
    [
      "zh/safety/07-law-regulation-policy.qmd",
      ["欧盟的风险分级", "发布如今在法律上要求哪些文档", "版权为什么仍是每一份预训练语料下面不稳定的基础", "监管者写下的规则改写"],
    ],
    [
      "en/safety/index.qmd",
      ["Safety is not one layer", "what the model is doing internally", "where evidence is created", "where authority is granted"],
    ],
    [
      "zh/safety/index.qmd",
      ["安全不是放在栈顶的一层外壳", "模型内部发生了什么", "证据在哪里产生", "权限在哪里授予"],
    ],
    [
      "en/ecosystem/01-model-landscape.qmd",
      ["open-to-closed spectrum", "release can disclose five things", "weight license", "almost every published training practice", "open labs rather than the largest closed"],
    ],
    [
      "zh/ecosystem/01-model-landscape.qmd",
      ["从开放到封闭的连续区间", "一次发布可以披露哪五样东西", "权重许可证", "已公开的训练实践", "开放实验室"],
    ],
    [
      "en/ecosystem/02-tooling-ecosystem.qmd",
      ["training frameworks, serving engines, agent frameworks", "standards that let them interoperate", "control point", "caller stops being an application and becomes an agent", "move back into the layer itself"],
    ],
    [
      "zh/ecosystem/02-tooling-ecosystem.qmd",
      ["训练框架、服务引擎、智能体框架", "彼此互通的标准", "控制点", "调用方不再是一个应用、而变成一个智能体", "拉回到该层自身"],
    ],
    [
      "en/ecosystem/03-economics.qmd",
      ["whole stack is a way to spend money", "where compute is bought", "training and inference are two different kinds of cost", "build a model versus buy one through an API", "inference dominates the lifetime bill"],
    ],
    [
      "zh/ecosystem/03-economics.qmd",
      ["整个技术栈最终都会落实为一套成本结构", "算力在哪里购买", "训练与推断为什么是两种性质不同的成本", "什么时候该自建一个模型、什么时候该通过 API 买一个", "推断主导全生命周期账单"],
    ],
    [
      "en/ecosystem/index.qmd",
      ["who can afford", "prices feed back into design", "terms under which capability is made available"],
    ],
    [
      "zh/ecosystem/index.qmd",
      ["谁有能力做这些事", "价格怎样反过来改变设计", "能力以什么条件被交付"],
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
      ["用@gls-fsm给 logits 做掩码", "预计算索引和跳跃式前向", "滑动窗口、@gls-attention-sink 与重击者驱逐", "查询感知策略"],
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
      "en/inference/index.qmd",
      ["not a smaller version of training", "prefill and decode", "turns capability into something repeatable"],
    ],
    [
      "zh/inference/index.qmd",
      ["不是训练阶段的简化版本", "预填充与解码占用的资源不同", "能力变成可重复交付"],
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
      ["稀缺的资源是字节，而不是算术", "小芯片封装", "NVLink 边界从机箱移到机架", "不断抬高的算术强度门槛"],
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
      ["几乎在任何时刻都有某处在出故障", "预防故障」转向「摊销故障", "不发出警报", "延迟层级和解码带宽限制", "连跑数小时的智能体"],
    ],
    [
      "en/infrastructure/07-where-learning-hits-limits.qmd",
      ["cheap resource that powered", "synthetic data, reinforcement learning on reasoning", "imitate a finite corpus", "change that answer rather than defer it"],
    ],
    [
      "zh/infrastructure/07-where-learning-hits-limits.qmd",
      ["廉价资源正在接近耗尽", "数据墙、合成数据、在推理上做强化学习", "模仿一个有限的语料", "真正改变了这个答案"],
    ],
    [
      "en/infrastructure/08-the-capability-horizon.qmd",
      ["frontier is no longer a leaderboard number", "moving horizon", "instruments saturate faster than they can be built", "durable progress", "compute-bought artifact", "headline number"],
    ],
    [
      "zh/infrastructure/08-the-capability-horizon.qmd",
      ["不再是一个排行榜数字", "移动的地平线", "测量仪器饱和得比新仪器造出来还快", "可持续的进步", "由算力支撑的短期表象"],
    ],
    [
      "en/infrastructure/09-verification-frontier.qmd",
      ["verification frontier", "claim with evidence", "Formal proof as infrastructure", "Discovery loops need evaluators", "When the verifier is weaker"],
    ],
    [
      "zh/infrastructure/09-verification-frontier.qmd",
      ["验证前沿", "带证据的主张", "作为基础设施的形式证明", "发现循环需要评估器", "当验证者更弱时"],
    ],
    [
      "en/infrastructure/index.qmd",
      ["lower layers are stubbornly physical", "what the machine makes possible", "constraints become visible"],
    ],
    [
      "zh/infrastructure/index.qmd",
      ["最底下始终是物理机器", "机器已经替我们决定了什么", "约束变得清楚"],
    ],
    [
      "en/practice/01-choosing-a-model.qmd",
      ["closed-to-open axis", "license", "three leaderboards", "small eval", "vendor's weekly point release"],
    ],
    [
      "zh/practice/01-choosing-a-model.qmd",
      ["从闭源到开源的坐标轴", "许可证", "三个排行榜", "小规模评测", "每周一次的小版本更新"],
    ],
    [
      "en/practice/02-serving-and-compute.qmd",
      ["self-hosted endpoint", "@gls-gateway", "keys and cost control", "serving engine that decodes tokens", "GPUs underneath"],
    ],
    [
      "zh/practice/02-serving-and-compute.qmd",
      ["自托管端点", "@gls-gateway", "密钥与成本", "解码 token 的服务引擎", "下方的 GPU"],
    ],
    [
      "en/practice/03-edge-on-device.qmd",
      ["architected small rather than shrunk", "over-trained", "server's int4 floor", "two bits and below", "ternary weights", "cloud-versus-edge split"],
    ],
    [
      "zh/practice/03-edge-on-device.qmd",
      ["设计得小", "过度训练", "int4 底线", "2 比特乃至更低", "三元权重", "云与边缘的切分"],
    ],
    [
      "en/practice/04-training-finetuning-practice.qmd",
      ["which tools should change a model's weights", "wire into the rest of the stack", "should the team be training at all"],
    ],
    [
      "zh/practice/04-training-finetuning-practice.qmd",
      ["该用哪些工具改变模型权重", "把它接进剩下的技术栈", "到底该不该训练"],
    ],
    [
      "en/practice/05-agents-and-sandboxes.qmd",
      ["loop archetype", "tool protocol", "sandbox boundary", "secrets and model access", "governed seams"],
    ],
    [
      "zh/practice/05-agents-and-sandboxes.qmd",
      ["循环原型", "工具协议", "沙箱边界", "密钥和模型访问", "受治理的接缝"],
    ],
    [
      "en/practice/06-retrieval-and-documents.qmd",
      ["data it was never trained on", "document intelligence", "structured text", "embeddings in a vector store", "reranker orders"],
    ],
    [
      "zh/practice/06-retrieval-and-documents.qmd",
      ["从未训练过的数据", "文档智能", "结构化文本", "向量库里的嵌入", "重排器"],
    ],
    [
      "en/practice/07-evaluation-and-observability.qmd",
      ["public leaderboard", "specific prompt", "retrieval context", "agent loop", "running system"],
    ],
    [
      "zh/practice/07-evaluation-and-observability.qmd",
      ["公开榜单", "特定", "检索上下文", "智能体循环", "正在运行的那个系统"],
    ],
    [
      "en/practice/08-wiring-a-2026-stack.qmd",
      ["capability has a lifecycle", "end-to-end reference architecture", "seams can be named", "virtual-key custody", "three wire-format contracts"],
    ],
    [
      "zh/practice/08-wiring-a-2026-stack.qmd",
      ["能力是有生命周期", "端到端的参考架构", "接缝能否说清", "虚拟密钥托管", "三份传输格式契约"],
    ],
    [
      "en/practice/09-deployment-lifecycle.qmd",
      ["deployable artifact is a bundle", "promotion is a statistical pipeline", "rollback has to restore", "model, prompts, retrieval indexes, tools"],
    ],
    [
      "zh/practice/09-deployment-lifecycle.qmd",
      ["可部署的产物是一个捆绑包", "统计意义上的提升流水线", "回滚必须把模型、提示、检索索引、工具与护栏配置一起恢复"],
    ],
    [
      "en/practice/10-reliability-nondeterministic.qmd",
      ["@gls-sli for an output that is never twice the same", "measure a distribution", "reliable at every single step", "chase determinism", "embrace sampling and verify"],
    ],
    [
      "zh/practice/10-reliability-nondeterministic.qmd",
      ["永远不会两次相同的输出", "@gls-sli 必须度量分布", "每一步都可靠的智能体", "追求确定性", "接纳采样并校验"],
    ],
    [
      "en/practice/11-human-interface-oversight.qmd",
      ["surface is not just user experience", "calibrated reliance", "approval gate", "Correction loops", "@gls-automation-bias"],
    ],
    [
      "zh/practice/11-human-interface-oversight.qmd",
      ["它是一块控制面板", "校准后的依赖", "批准门", "修正回路", "@gls-automation-bias"],
    ],
    [
      "en/practice/12-production-data-engine.qmd",
      ["records of real users", "standing apparatus", "training signal", "scarce labeling budget", "intake of the next one"],
    ],
    [
      "zh/practice/12-production-data-engine.qmd",
      ["真实用户提出真实问题", "常设装置", "训练信号", "稀缺标注预算", "下一轮循环的入口"],
    ],
    [
      "en/practice/13-operating-contracts.qmd",
      ["what it promises, what it costs", "operating contract", "Cost Governance", "Tenant boundary", "evidence store"],
    ],
    [
      "zh/practice/13-operating-contracts.qmd",
      ["承诺什么、花费什么", "运营契约", "成本治理", "租户边界", "证据库"],
    ],
    [
      "en/practice/index.qmd",
      ["deadlines, budgets, licenses", "production AI system as a set of contracts", "tenant boundary", "something a team can operate"],
    ],
    [
      "zh/practice/index.qmd",
      ["期限、预算、许可证", "生产 AI 系统看成一组契约", "租户边界", "可以运营的系统"],
    ],
    [
      "en/summary.qmd",
      [
        "artificial intelligence is now best understood as infrastructure",
        "The book followed one capability through that stack",
        "capability alone does not make infrastructure",
        "Infrastructure is not merely machinery",
        "what we are willing to remain responsible for",
      ],
    ],
    [
      "zh/summary.qmd",
      [
        "人工智能，最好把它看作基础设施",
        "本书沿着一项能力走过了这套栈",
        "能力本身还不足以成为基础设施",
        "基础设施不只是机器",
        "我们仍愿意为哪些东西负责",
      ],
    ],
  ];

  for (const [path, snippets] of checks) {
    const text = readFileSync(join(repoRoot, path), "utf8");
    const normalizedText = text.replace(/\s+/g, " ");
    for (const snippet of snippets) {
      const normalizedSnippet = snippet.replace(/\s+/g, " ");
      expect(normalizedText, `${path} should preserve ${snippet}`).toContain(normalizedSnippet);
    }
  }
});

test("polished chapter openings avoid reader-promise templates", () => {
  const polished = [
    "en/index.qmd",
    "en/summary.qmd",
    "en/orientation/index.qmd",
    "en/orientation/01-whole-stack.qmd",
    "en/orientation/02-field-map.qmd",
    "en/orientation/03-borrowed-ideas.qmd",
    "en/foundations/01-scaling-laws.qmd",
    "en/foundations/02-data-curation.qmd",
    "en/foundations/03-tokenization.qmd",
    "en/foundations/04-transformer-architecture.qmd",
    "en/foundations/05-moe-ssm-hybrids.qmd",
    "en/foundations/06-training-at-scale.qmd",
    "en/foundations/07-mid-training.qmd",
    "en/foundations/index.qmd",
    "en/generative/index.qmd",
    "en/generative/01-diffusion-flow-matching.qmd",
    "en/generative/02-nar-diffusion-lms.qmd",
    "en/generative/03-speech-and-voice.qmd",
    "en/generative/04-multimodal-models.qmd",
    "en/generative/05-beyond-text.qmd",
    "en/adaptation/01-sft-peft.qmd",
    "en/adaptation/02-behavior-specs-preference-data.qmd",
    "en/adaptation/03-rlhf-reward-modeling.qmd",
    "en/adaptation/04-dpo-variants.qmd",
    "en/adaptation/05-verifiable-rewards-reasoning.qmd",
    "en/adaptation/06-safety-tuning-instruction-hierarchy.qmd",
    "en/adaptation/07-synthetic-data-self-improvement.qmd",
    "en/adaptation/index.qmd",
    "en/reasoning/index.qmd",
    "en/reasoning/01-eliciting-reasoning.qmd",
    "en/reasoning/02-structured-reasoning-search.qmd",
    "en/reasoning/03-programs-solvers-symbolic.qmd",
    "en/reasoning/04-verifiers-process-supervision.qmd",
    "en/reasoning/05-training-to-reason.qmd",
    "en/reasoning/06-reasoning-data-distillation.qmd",
    "en/reasoning/07-inference-time-scaling.qmd",
    "en/orchestration/01-training-agents-to-act.qmd",
    "en/orchestration/02-agent-architectures.qmd",
    "en/orchestration/03-memory-systems.qmd",
    "en/orchestration/04-the-harness.qmd",
    "en/orchestration/05-multi-agent-systems.qmd",
    "en/orchestration/06-rag-retrieval.qmd",
    "en/orchestration/07-embeddings-representation.qmd",
    "en/orchestration/08-context-engineering.qmd",
    "en/evaluation/index.qmd",
    "en/evaluation/01-benchmarks.qmd",
    "en/evaluation/02-statistical-reliability.qmd",
    "en/evaluation/03-human-evaluation-rubrics.qmd",
    "en/evaluation/04-judging-holistic.qmd",
    "en/evaluation/05-factuality-grounding.qmd",
    "en/evaluation/06-evaluating-agents.qmd",
    "en/evaluation/07-operational-evaluation.qmd",
    "en/safety/index.qmd",
    "en/safety/01-mechanistic-interpretability.qmd",
    "en/safety/02-scalable-oversight-control.qmd",
    "en/safety/03-security-authorization.qmd",
    "en/safety/04-runtime-safety.qmd",
    "en/safety/05-adversarial-robustness.qmd",
    "en/safety/06-privacy-provenance-unlearning.qmd",
    "en/safety/07-law-regulation-policy.qmd",
    "en/ecosystem/01-model-landscape.qmd",
    "en/ecosystem/02-tooling-ecosystem.qmd",
    "en/ecosystem/03-economics.qmd",
    "en/ecosystem/index.qmd",
    "en/inference/01-serving-problem.qmd",
    "en/inference/02-memory-scheduling.qmd",
    "en/inference/03-faster-decoding.qmd",
    "en/inference/04-quantization-kernels.qmd",
    "en/inference/05-structured-long-context.qmd",
    "en/inference/06-serving-multimodal.qmd",
    "en/inference/index.qmd",
    "en/infrastructure/01-accelerators-networking.qmd",
    "en/infrastructure/02-orchestration-data-infra.qmd",
    "en/infrastructure/03-the-compute-frontier.qmd",
    "en/infrastructure/04-making-the-silicon.qmd",
    "en/infrastructure/05-powering-it.qmd",
    "en/infrastructure/06-the-machine-that-breaks.qmd",
    "en/infrastructure/07-where-learning-hits-limits.qmd",
    "en/infrastructure/08-the-capability-horizon.qmd",
    "en/infrastructure/09-verification-frontier.qmd",
    "en/infrastructure/index.qmd",
    "en/practice/01-choosing-a-model.qmd",
    "en/practice/02-serving-and-compute.qmd",
    "en/practice/03-edge-on-device.qmd",
    "en/practice/04-training-finetuning-practice.qmd",
    "en/practice/05-agents-and-sandboxes.qmd",
    "en/practice/06-retrieval-and-documents.qmd",
    "en/practice/07-evaluation-and-observability.qmd",
    "en/practice/08-wiring-a-2026-stack.qmd",
    "en/practice/09-deployment-lifecycle.qmd",
    "en/practice/10-reliability-nondeterministic.qmd",
    "en/practice/11-human-interface-oversight.qmd",
    "en/practice/12-production-data-engine.qmd",
    "en/practice/13-operating-contracts.qmd",
    "en/practice/index.qmd",
    "zh/index.qmd",
    "zh/summary.qmd",
    "zh/orientation/index.qmd",
    "zh/orientation/01-whole-stack.qmd",
    "zh/orientation/02-field-map.qmd",
    "zh/orientation/03-borrowed-ideas.qmd",
    "zh/foundations/01-scaling-laws.qmd",
    "zh/foundations/02-data-curation.qmd",
    "zh/foundations/03-tokenization.qmd",
    "zh/foundations/04-transformer-architecture.qmd",
    "zh/foundations/05-moe-ssm-hybrids.qmd",
    "zh/foundations/06-training-at-scale.qmd",
    "zh/foundations/07-mid-training.qmd",
    "zh/foundations/index.qmd",
    "zh/generative/index.qmd",
    "zh/generative/01-diffusion-flow-matching.qmd",
    "zh/generative/02-nar-diffusion-lms.qmd",
    "zh/generative/03-speech-and-voice.qmd",
    "zh/generative/04-multimodal-models.qmd",
    "zh/generative/05-beyond-text.qmd",
    "zh/adaptation/01-sft-peft.qmd",
    "zh/adaptation/02-behavior-specs-preference-data.qmd",
    "zh/adaptation/03-rlhf-reward-modeling.qmd",
    "zh/adaptation/04-dpo-variants.qmd",
    "zh/adaptation/05-verifiable-rewards-reasoning.qmd",
    "zh/adaptation/06-safety-tuning-instruction-hierarchy.qmd",
    "zh/adaptation/07-synthetic-data-self-improvement.qmd",
    "zh/adaptation/index.qmd",
    "zh/reasoning/index.qmd",
    "zh/reasoning/01-eliciting-reasoning.qmd",
    "zh/reasoning/02-structured-reasoning-search.qmd",
    "zh/reasoning/03-programs-solvers-symbolic.qmd",
    "zh/reasoning/04-verifiers-process-supervision.qmd",
    "zh/reasoning/05-training-to-reason.qmd",
    "zh/reasoning/06-reasoning-data-distillation.qmd",
    "zh/reasoning/07-inference-time-scaling.qmd",
    "zh/orchestration/01-training-agents-to-act.qmd",
    "zh/orchestration/02-agent-architectures.qmd",
    "zh/orchestration/03-memory-systems.qmd",
    "zh/orchestration/04-the-harness.qmd",
    "zh/orchestration/05-multi-agent-systems.qmd",
    "zh/orchestration/06-rag-retrieval.qmd",
    "zh/orchestration/07-embeddings-representation.qmd",
    "zh/orchestration/08-context-engineering.qmd",
    "zh/evaluation/index.qmd",
    "zh/evaluation/01-benchmarks.qmd",
    "zh/evaluation/02-statistical-reliability.qmd",
    "zh/evaluation/03-human-evaluation-rubrics.qmd",
    "zh/evaluation/04-judging-holistic.qmd",
    "zh/evaluation/05-factuality-grounding.qmd",
    "zh/evaluation/06-evaluating-agents.qmd",
    "zh/evaluation/07-operational-evaluation.qmd",
    "zh/safety/index.qmd",
    "zh/safety/01-mechanistic-interpretability.qmd",
    "zh/safety/02-scalable-oversight-control.qmd",
    "zh/safety/03-security-authorization.qmd",
    "zh/safety/04-runtime-safety.qmd",
    "zh/safety/05-adversarial-robustness.qmd",
    "zh/safety/06-privacy-provenance-unlearning.qmd",
    "zh/safety/07-law-regulation-policy.qmd",
    "zh/ecosystem/01-model-landscape.qmd",
    "zh/ecosystem/02-tooling-ecosystem.qmd",
    "zh/ecosystem/03-economics.qmd",
    "zh/ecosystem/index.qmd",
    "zh/inference/01-serving-problem.qmd",
    "zh/inference/02-memory-scheduling.qmd",
    "zh/inference/03-faster-decoding.qmd",
    "zh/inference/04-quantization-kernels.qmd",
    "zh/inference/05-structured-long-context.qmd",
    "zh/inference/06-serving-multimodal.qmd",
    "zh/inference/index.qmd",
    "zh/infrastructure/01-accelerators-networking.qmd",
    "zh/infrastructure/02-orchestration-data-infra.qmd",
    "zh/infrastructure/03-the-compute-frontier.qmd",
    "zh/infrastructure/04-making-the-silicon.qmd",
    "zh/infrastructure/05-powering-it.qmd",
    "zh/infrastructure/06-the-machine-that-breaks.qmd",
    "zh/infrastructure/07-where-learning-hits-limits.qmd",
    "zh/infrastructure/08-the-capability-horizon.qmd",
    "zh/infrastructure/09-verification-frontier.qmd",
    "zh/infrastructure/index.qmd",
    "zh/practice/01-choosing-a-model.qmd",
    "zh/practice/02-serving-and-compute.qmd",
    "zh/practice/03-edge-on-device.qmd",
    "zh/practice/04-training-finetuning-practice.qmd",
    "zh/practice/05-agents-and-sandboxes.qmd",
    "zh/practice/06-retrieval-and-documents.qmd",
    "zh/practice/07-evaluation-and-observability.qmd",
    "zh/practice/08-wiring-a-2026-stack.qmd",
    "zh/practice/09-deployment-lifecycle.qmd",
    "zh/practice/10-reliability-nondeterministic.qmd",
    "zh/practice/11-human-interface-oversight.qmd",
    "zh/practice/12-production-data-engine.qmd",
    "zh/practice/13-operating-contracts.qmd",
    "zh/practice/index.qmd",
  ];
  const banned = /By the end|reader can explain|reader can say|A reader should finish|The reader should|the book asks the reader|the reader has|The reader is no longer|This chapter owns|This chapter is about|This chapter tells one story|读者读完|读完本章|读到本章末尾|读完这一章|读完这一部分|读完它|读者已经|读者面对|本书和读者|本章负责|本章来讲这个|本章把一个故事|本章要讲清/;

  for (const path of polished) {
    const text = readFileSync(join(repoRoot, path), "utf8");
    const opening = text.split(/\n## /)[0] ?? text;
    const normalizedOpening = opening.replace(/\s+/g, " ");
    expect(normalizedOpening, `${path} should not use a reader-promise opener`).not.toMatch(banned);
  }
});

test("polished synthesis headings avoid generic reading-frame templates", () => {
  const enHeadingTemplate =
    /^## (?:(?:Reading (?!instructions\b)|Read (?:the|this)\b)|(?:The )?Capability, efficiency, trust\b|(?:The )?capability, efficiency, trust lens\b|Closing: capability, efficiency, trust\b|Operating a deployment: capability, efficiency, trust\b|Trade-offs: capability, efficiency, trust\b)/im;
  const zhHeadingTemplate =
    /^## (?:读这|读懂|读隐私|把.*读|用.*读|解读生产数据引擎|先读|读排行榜|能力、效率、信任(?:之镜|三个视角)?|收束：能力、效率、信任|运维一次部署：能力、效率、信任|权衡：能力、效率、信任)/m;

  const enOffenders = qmdFiles(enRoot).filter((path) =>
    enHeadingTemplate.test(readFileSync(path, "utf8")),
  );
  const zhOffenders = qmdFiles(zhRoot).filter((path) =>
    zhHeadingTemplate.test(readFileSync(path, "utf8")),
  );

  expect(enOffenders.map((path) => path.replace(enRoot + "/", ""))).toEqual([]);
  expect(zhOffenders.map((path) => path.replace(zhRoot + "/", ""))).toEqual([]);
});

test("polished prose avoids canned lens closers", () => {
  const enLensCloser =
    /\b(?:Read through|Through) the book's closing lens\b|\bThe closing lens is capability, efficiency, and trust\b|\bThe capability, efficiency, (?:and )?trust lens (?:closes|ties)\b|\bRead through the capability, efficiency, and trust lens\b/;
  const zhLensCloser =
    /透过本书(?:一直携带|收束|收束全章)的那面[^\n，。]*[透棱]镜|收束的透镜是能力、效率与信任|能力、效率、信任(?:这个|的)?透镜|能力、效率、信任[^。]*之镜/;

  const enOffenders = qmdFiles(enRoot).filter((path) =>
    enLensCloser.test(readFileSync(path, "utf8")),
  );
  const zhOffenders = qmdFiles(zhRoot).filter((path) =>
    zhLensCloser.test(readFileSync(path, "utf8")),
  );

  expect(enOffenders.map((path) => path.replace(enRoot + "/", ""))).toEqual([]);
  expect(zhOffenders.map((path) => path.replace(zhRoot + "/", ""))).toEqual([]);
});

test("polished zh prose avoids reader-instruction filler connectors", () => {
  const banned =
    /事实上有四个答案|显然|按摄取顺序来读|按顺序读下来|接下来读这三个存储|读这些来学方法|值得留意的是|读懂上面那场审判|读懂这个信号/;
  const offenders = qmdFiles(zhRoot).filter((path) =>
    banned.test(readFileSync(path, "utf8")),
  );

  expect(offenders.map((path) => path.replace(zhRoot + "/", ""))).toEqual([]);
});

test("polished prose avoids canned lesson connectors", () => {
  const enBanned =
    /\bThe lesson is (?:that|not)\b|It is worth tracing\b|worth reading as|They are worth reading\b/;
  const zhBanned = /这给出一个教训|这里的教训不是|值得一读|值得当作两个变体来读/;

  const enOffenders = qmdFiles(enRoot).filter((path) =>
    enBanned.test(readFileSync(path, "utf8")),
  );
  const zhOffenders = qmdFiles(zhRoot).filter((path) =>
    zhBanned.test(readFileSync(path, "utf8")),
  );

  expect(enOffenders.map((path) => path.replace(enRoot + "/", ""))).toEqual([]);
  expect(zhOffenders.map((path) => path.replace(zhRoot + "/", ""))).toEqual([]);
});

test("polished prose avoids read-as-analysis scaffolds", () => {
  const enBanned =
    /best read by|field read by|To see why, we have to ask|best read as|best read in|are best read|is best read/;
  const zhBanned =
    /按各自在押注哪种带宽解法来读|按各家在优化什么来读|按各家针对带宽墙在优化什么、而非按峰值 FLOPs 来读|按「少浪费一点缓存」来读/;

  const enOffenders = qmdFiles(enRoot).filter((path) =>
    enBanned.test(readFileSync(path, "utf8")),
  );
  const zhOffenders = qmdFiles(zhRoot).filter((path) =>
    zhBanned.test(readFileSync(path, "utf8")),
  );

  expect(enOffenders.map((path) => path.replace(enRoot + "/", ""))).toEqual([]);
  expect(zhOffenders.map((path) => path.replace(zhRoot + "/", ""))).toEqual([]);
});

test("public prose avoids internal draft markers", () => {
  const banned = /marked as `TODO`|标为 `TODO`|FIXME|TBD|PUBLISH-GATED|待补|待写|公开前需要审阅/;
  const offenders = [...qmdFiles(enRoot), ...qmdFiles(zhRoot)].filter((path) =>
    banned.test(readFileSync(path, "utf8")),
  );

  expect(
    offenders.map((path) => path.replace(repoRoot + "/", "")),
  ).toEqual([]);
});
