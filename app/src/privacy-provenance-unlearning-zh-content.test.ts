import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const english = readFileSync(
  new URL("../../en/safety/06-privacy-provenance-unlearning.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/safety/06-privacy-provenance-unlearning.qmd", import.meta.url),
  "utf8",
);
const flat = chapter.replace(/\*\*/g, "").replace(/\s+/g, " ");

function headings(source: string, level: 1 | 2 | 3): string[] {
  return [...source.matchAll(new RegExp(`^${"#".repeat(level)} (.+)$`, "gm"))].map(
    (match) => match[1],
  );
}

function displayMath(source: string): string[] {
  return [...source.matchAll(/^\$\$\n([\s\S]*?)\n\$\$$/gm)].map(
    (match) => match[1],
  );
}

function canonicalMath(source: string): string {
  return source
    .replace(/\\(?:begin|end)\{(?:aligned|gathered)\}/g, "")
    .replace(/\\\\/g, "")
    .replace(/\\quad|\\qquad|&|\{\}/g, "")
    .replace(/\s+/g, "");
}

function citationsAndCrossrefs(source: string): string[] {
  return [...source.matchAll(/(?<![A-Za-z0-9])@[A-Za-z0-9_-]+/g)].map(
    (match) => match[0],
  );
}

function htmlFigureIds(source: string): string[] {
  return [...source.matchAll(/^<figure id="([^"]+)">$/gm)].map(
    (match) => match[1],
  );
}

test("Chapter 59 preserves the complete English privacy evidence contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "隐私、来源与机器遗忘 {#sec-privacy-provenance}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "四种事件，而不是一次“泄露”",
    "在训练前后降低风险",
    "差分隐私的形式化承诺",
    "以重新训练为基准定义机器遗忘",
    "来源提供证据，而非事实",
    "保留运行记录",
    "争议所在",
    "下层约束",
    "三种承诺，三类证据",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual([
    "先写清隐私威胁模型",
    "SISA：在训练设计中预留删除能力",
    "同时评估遗忘、保留与恢复",
    "删除是一项数据谱系操作",
    "知识编辑是另一种操作",
    "统计水印",
    "签名内容凭证",
    "回归场景",
  ]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```yaml$/gm)?.length).toBe(1);
  expect(htmlFigureIds(chapter)).toEqual(htmlFigureIds(english));
  expect(chapter.match(/^!\[/gm)).toBeNull();
});

test("the opening separates three promises and three kinds of proof", () => {
  for (const phrase of [
    "隐私、机器遗忘和来源回答的是三个不同的问题",
    "训练数据隐私关心的是",
    "机器遗忘关心的是",
    "来源关心的是",
    "这三种承诺不能相互推出",
    "保护训练记录并不意味着输出带有来源证据",
    "签名输出仍然可能泄露隐私",
    "隐私需要明确受保护的单位和攻击者模型",
    "机器遗忘需要以仅用保留数据重新训练的结果为参照",
    "来源需要明确机制、签名者或密钥，以及验证策略",
  ]) expect(flat).toContain(phrase);
});

test("memorization extraction disclosure and membership remain distinct", () => {
  for (const phrase of [
    "记忆是训练模型与某个训练样本之间可度量的依赖关系",
    "可抽取性是指攻击者能否恢复未知的训练序列",
    "被记住的序列不一定能够被抽取",
    "披露是指发布的输出泄露了某个人的敏感信息",
    "被抽取的序列不一定属于个人数据",
    "成员推断判断给定样本是否属于训练数据集",
    "数据集成员身份本身就可能敏感",
    "这些是不同的事件",
  ]) expect(flat).toContain(phrase);
});

test("the privacy threat model fixes scope access success and harm", () => {
  for (const phrase of [
    "隐私单位",
    "记录级保护和用户级保护并不相同",
    "相邻关系",
    "攻击者访问能力",
    "辅助信息、自适应查询和查询预算",
    "成功标准",
    "对受影响者造成的伤害",
    "按相关语言和记录类型报告尾部结果",
  ]) expect(flat).toContain(phrase);
});

test("data and serving controls keep their guarantees bounded", () => {
  for (const phrase of [
    "数据最小化和目的限制",
    "假名化并不等于删除",
    "去重降低了这些实验中测得的记忆",
    "并不提供差分隐私保证",
    "PII 检测既有假阳性，也有假阴性",
    "派生数据集、词元化副本和微调数据",
    "服务阶段的控制仍然重要",
    "不能移除训练数据的影响",
    "无法收回已经披露的信息",
    "不应被描述为机器遗忘",
  ]) expect(flat).toContain(phrase);
});

test("differential privacy defines its unit accounting and utility limits", () => {
  for (const phrase of [
    "随机训练机制",
    "相邻数据集 $D$ 和 $D'$",
    "所有可测的输出集合 $S$",
    "隐私损失上界",
    "隐私单位决定相邻关系的含义",
    "$\\varepsilon$ 越小，隐私保证越强",
    "逐样本梯度",
    "裁剪范数 $C$",
    "噪声乘数",
    "隐私损失会随训练步骤和其他发布结果累积",
    "隐私会计器",
    "效用必须在部署人群和罕见情形上实测",
  ]) expect(flat).toContain(phrase);
});

test("machine unlearning is evaluated against retained-data retraining", () => {
  for (const phrase of [
    "@gls-machine-unlearning，也就是试图从已训练模型中移除指定训练数据影响的过程",
    "$D_f$ 表示遗忘集",
    "$D_r=D\\setminus D_f$ 表示保留数据集",
    "$\\mathcal{U}$ 表示机器遗忘算法",
    "重新训练参照",
    "精确机器遗忘",
    "近似机器遗忘",
    "目标必须是分布",
    "匹配某一个检查点或某一个回答并不符合定义",
    "也不一定会抹去保留数据中仍然存在的语义事实",
  ]) expect(flat).toContain(phrase);
});

test("SISA states its architecture operational assumptions and scope", () => {
  for (const phrase of [
    "互不重叠的分片",
    "累积切片",
    "只重新训练受影响的组件",
    "必须提前设计进训练流程",
    "分片和切片分配、随机性、检查点以及聚合过程都必须可复现",
    "学习得到的聚合器本身也可能需要执行删除",
    "不能让任意的事后编辑变成精确机器遗忘",
  ]) expect(flat).toContain(phrase);
});

test("unlearning evaluation covers forgetting retention recovery and operations", () => {
  for (const phrase of [
    "遗忘集行为",
    "保留集效用",
    "恢复能力",
    "运行成本",
    "直接提示、改述和自适应提示",
    "短程微调或重新学习攻击",
    "一次拒绝不能证明模型已经完成机器遗忘",
    "不能把附带损害藏在平均值里",
    "TOFU 是有用的基准，而不是通用证书",
  ]) expect(flat).toContain(phrase);
});

test("deletion follows the full lineage and prevents re-ingestion", () => {
  for (const phrase of [
    "源记录、数据集快照、去重副本、转换后和词元化的数据",
    "检查点、优化器状态、适配器、合并模型、集成模型和模型注册表副本",
    "嵌入、检索索引、评估样例、缓存、日志和备份",
    "删除墓碑",
    "防止数据被意外重新摄取",
    "不能保留已经删除的内容本身",
    "遗漏的检查点或适配器副本可能恢复旧行为",
  ]) expect(flat).toContain(phrase);
});

test("knowledge editing remains distinct from record deletion", () => {
  for (const phrase of [
    "知识编辑不是机器遗忘",
    "改变模型选定的行为",
    "不能证明训练记录的影响已经消失",
    "改述或逻辑推论",
    "造成连带变化",
    "保留成员身份信号",
    "产品承诺是改变回答时，可以使用知识编辑",
  ]) expect(flat).toContain(phrase);
});

test("watermark evidence reports thresholds errors base rates and attacks", () => {
  for (const phrase of [
    "检测器阈值",
    "假阳性率、假阴性率、弃权策略、文本长度、语言、采样配置和模型版本",
    "评估所依据的基率",
    "水印文本很少时，即使假阳性率很低，误报也可能占多数",
    "截断、普通编辑、水印改述、翻译、模型重写和人机混合文本",
    "检测不到水印不能证明文本由人类创作",
    "支持的是经过测试的机制和配置，而不是通用的 AI 文本检测器",
  ]) expect(flat).toContain(phrase);
});

test("C2PA evidence authenticates claims without certifying truth", () => {
  for (const phrase of [
    "C2PA 用签名清单表示来源声明",
    "资产哈希或其他内容绑定",
    "防篡改证据",
    "验证仍然需要策略",
    "未知签名者并不自动意味着恶意",
    "有效凭证不能证明画面中的事件确实发生",
    "清单被剥离意味着证据缺失，而不是验证成功",
    "未签名资产也不能证明该资产是合成内容",
  ]) expect(flat).toContain(phrase);
});

test("the operating record preserves failures rather than manufacturing claims", () => {
  for (const field of [
    "data_subject_or_record_scope",
    "source_and_legal_basis",
    "dataset_and_transform_revisions",
    "privacy_unit_and_adjacency",
    "dp_mechanism_and_accountant",
    "training_job_and_artifact_revisions",
    "deletion_request_and_tombstone",
    "affected_artifact_inventory",
    "unlearning_method_and_retraining_reference",
    "forget_retain_and_privacy_results",
    "provenance_mechanism_and_signer",
    "detector_threshold_and_error_rates",
    "verification_and_exception_owner",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "机器可读并带有版本",
    "不要让这套结构自动生成它无法支持的主张",
    "空字段、例外和验证失败都必须保留",
    "谱系和删除证据本身也可能识别个人",
  ]) expect(flat).toContain(phrase);
});

test("regressions exercise privacy deletion lineage and provenance failures", () => {
  for (const phrase of [
    "重复的金丝雀样本",
    "同一用户分散在多条记录中",
    "PII 检测器漏检",
    "成员推断中的分布偏移",
    "检查点和适配器副本",
    "遗忘集改述",
    "重新学习攻击",
    "保留集效用回退",
    "水印改述",
    "人类文本假阳性",
    "被剥离的 C2PA 清单",
    "遭篡改的资产",
  ]) expect(flat).toContain(phrase);
});

test("contested questions and lower-layer constraints preserve uncertainty", () => {
  for (const phrase of [
    "什么样的经验证据足以支持近似机器遗忘",
    "通过今天的探测并不能排除明天更强的自适应或白盒测试",
    "哪一种水印威胁模型有实际价值",
    "产品主张必须与实测的编辑方式、文本长度、语言和错误率一致",
    "差分隐私在什么情况下值得承担效用代价",
    "完整的数据谱系才能支持有范围的删除",
    "这些层彼此约束，却不能相互替代",
    "上层无法在事后补造这些证据",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion maps each promise to its own evidence", () => {
  for (const phrase of [
    "隐私的证据来自威胁模型、实测攻击、数据控制",
    "机器遗忘的证据来自数据谱系，以及与仅保留数据重新训练结果的比较",
    "来源的证据来自水印检测器，或信任策略下经过验证的签名声明",
    "哪些内容得到保护、哪些影响已被移除、哪些声明经过签名，以及哪些问题仍然未知",
  ]) expect(flat).toContain(phrase);
});

test("machine-like legacy framing and unsupported artifacts are absent", () => {
  expect(chapter).not.toContain("/figures/privacy-provenance-unlearning-1.svg");
  for (const phrase of [
    "模型是训练集的一次有损压缩",
    "唯一稳妥的修补处",
    "记忆不是学习之外额外叠上的 bug",
    "泄露是真实的，不是假想",
    "成员推断是成本最低的隐私攻击",
    "最有效的单一记忆控制手段",
    "没有哪个旗舰通用模型",
    "这条基线代价很高",
    "唯一保留了精确保证的做法",
    "这一层几乎纯粹关乎信任",
    "最不舒服的结论",
  ]) expect(flat).not.toContain(phrase);
  expect(chapter).not.toContain("—");
});

test("the localized privacy diagram reserves a readable caption width on mobile", async () => {
  const block = chapter.match(/```\{dot\}\n([\s\S]*?)\n```/)?.[1];
  expect(block).toBeDefined();
  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(block!), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeGreaterThanOrEqual(150);
  expect(widthPt).toBeLessThanOrEqual(235);
});
