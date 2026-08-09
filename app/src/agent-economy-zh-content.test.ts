import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";
import { renderMarkdown, type RenderContext } from "./pipeline/markdown.ts";

const english = readFileSync(
  new URL("../../en/ecosystem/08-agent-economy.qmd", import.meta.url),
  "utf8",
);
const chinese = readFileSync(
  new URL("../../zh/ecosystem/08-agent-economy.qmd", import.meta.url),
  "utf8",
);
const flat = chinese.replace(/\*\*/g, "").replace(/\s+/g, " ");

function headings(source: string) {
  return [...source.matchAll(/^(#{2,3}) (.+)$/gm)].map((match) => [match[1], match[2]]);
}

function refs(source: string) {
  return [...source.matchAll(/@([a-z][a-z0-9-]*)/gi)].map((match) => match[1]);
}

test("Chinese Chapter 80 preserves the complete English structure", () => {
  expect(chinese).toMatch(/^# 智能体经济：身份、委托与机器支付 \{#sec-agent-economy\}/);
  expect(headings(chinese)).toEqual([
    ["##", "从角色入手，不要先看协议"],
    ["##", "身份不等于权限"],
    ["##", "授权书是一项有边界的指令"],
    ["##", "协议名称掩盖了不同职责"],
    ["##", "小额支付的经济性因何改变"],
    ["##", "跟踪交易，也要跟踪证据"],
    ["##", "x402 是支付协议，不是经济保证"],
    ["##", "有活动不等于经济体已经成熟"],
    ["##", "把交易契约落实到运营"],
    ["##", "争议所在"],
    ["##", "约束如何传导"],
    ["##", "延伸阅读"],
  ]);
  expect(refs(chinese)).toEqual(refs(english));
});

test("the thesis keeps authority payment and delivery as independent decisions", () => {
  for (const phrase of [
    "付费智能体是一条交易路径，不是新的法律主体",
    "哪套软件发出了请求",
    "哪位委托人给予了授权",
    "商户是否接受",
    "付款是否成功",
    "承诺的商品或服务是否已经交付",
    "身份不能证明权限",
    "权限不能证明意图",
    "付款不能证明交付",
    "签名记录也不能证明模型安全",
  ]) expect(flat).toContain(phrase);
});

test("six roles remain distinct even when one organization fills several", () => {
  for (const phrase of [
    "委托人",
    "智能体工作负载",
    "商户或资源服务器",
    "授权服务器",
    "支付服务商",
    "清算网络",
    "同一组织可以同时承担多个角色",
    "各项决定仍然彼此独立",
    "商户依据自身策略独立决定",
    "支付服务商也会独立决定",
    "价格、支付状态、履约，以及失败后的恢复",
  ]) expect(flat).toContain(phrase);
});

test("authentication is not confused with delegation or acceptance", () => {
  for (const phrase of [
    "RFC 9421",
    "HTTP 报文签名",
    "不能识别人类委托人，也不会授予购买权限",
    "Web Bot Auth",
    "截至 2026 年 8 月",
    "仍是正在推进的互联网草案，不是 RFC",
    "终端用户认证不在范围内",
    "Visa 规范，不是所有商务协议共用的通用身份层",
    "OAuth 不只是应用程序标识机制",
    "RFC 8693 令牌交换",
    "区分主体与行动方",
    "RFC 9396 富授权请求",
    "身份认证",
    "权限验证",
    "接收方仍须依据自身业务规则决定是否接受",
  ]) expect(flat).toContain(phrase);
});

test("a mandate is bounded evidence rather than proof of truth", () => {
  for (const phrase of [
    "无需还原整段对话",
    "目标接收方",
    "允许的操作和资源",
    "最高金额和币种",
    "签发时间和到期时间",
    "审批规则",
    "是否允许再次委托",
    "幂等键或随机数",
    "撤销引用",
    "开放式结账授权书",
    "封闭式结账授权书",
    "付款授权书",
    "不会自行完成清算，也不会自行分配法律责任",
    "可验证凭证",
    "不能证明声明为真，也不能要求验证方接受",
    "授权书是决策所需的证据，不是决策本身",
  ]) expect(flat).toContain(phrase);
});

test("protocols are mapped by function without inventing one mandatory stack", () => {
  for (const phrase of [
    "并不是一个强制性协议栈中可以互换的层",
    "请求认证和智能体识别",
    "受保护资源的授权与委托",
    "商品、结账、订单和能力协作",
    "结账与付款授权的交易证据",
    "智能体识别和可选的商务证据",
    "通过 HTTP 协商支付与协调清算",
    "商户仍是记录系统",
    "能力发现",
    "支付令牌交换",
    "可以组合使用",
    "不构成一张通用依赖图",
  ]) expect(flat).toContain(phrase);
  for (const stale of [
    "Web 从未建成的三条轨道",
    "第一个规模化部署",
    "没有哪家公司能独占其中任何一层",
  ]) expect(flat).not.toContain(stale);
});

test("micropayment models define compatible units and bounded thresholds", () => {
  const compact = chinese.replace(/\s+/g, "");
  for (const marker of [
    "o_{\\mathrm{agent}}(n)",
    "\\frac{c_m}{n}+c_a",
    "c_m/n+c_a<c_h",
    "m_n",
    "p(1-r)-\\frac{f}{n}-c",
  ]) expect(compact).toContain(marker);
  for (const phrase of [
    "买方为小额购买投入的注意力",
    "配置购物智能体只是转移了部分工作",
    "委托可以摊薄一次决策的成本，但不会让决策变成零成本",
    "一份授权书覆盖的购买次数",
    "每笔购买的智能体成本",
    "每笔购买的人类决策成本",
    "同一种单位和同一个核算期",
    "每批固定费用",
    "每笔请求的履约成本",
    "不会创造需求",
    "退款与争议成本",
  ]) expect(flat).toContain(phrase);
});

test("transaction evidence preserves uncertain states and recovery", () => {
  for (const phrase of [
    "端到端的一次交易尝试",
    "授权书版本",
    "经过认证的请求方",
    "报价",
    "商户决定",
    "支付服务商响应",
    "履约结果",
    "效果回执",
    "不要把它们压缩成一个 `success` 标志",
    "拒绝",
    "需要付款",
    "已授权",
    "已清算",
    "已履约",
    "失败",
    "未知",
    "已退款",
    "有争议",
    "稳定的幂等键",
    "拒绝重放的授权书或随机数",
    "至少一次消息投递",
    "业务效果恰好发生一次",
    "不可逆操作之前预留预算",
    "进入对账流程，而不是自动重试",
    "付款状态和履约状态要分开保存",
  ]) expect(flat).toContain(phrase);
});

test("x402 and MPP remain protocols rather than economic guarantees", () => {
  for (const phrase of [
    "402 Payment Required",
    "`PaymentRequired` 对象",
    "`PAYMENT-REQUIRED`",
    "`PAYMENT-SIGNATURE`",
    "促成方",
    "`PAYMENT-RESPONSE`",
    "客户端、资源服务器和可选的促成方",
    "不限定网络、代币和币种",
    "终局性、流动性、费用、合规、隐私和退款",
    "成功清算不能证明响应有用、只交付了一次",
    "不能保证需求或正利润",
    "可以协商稳定币、银行卡或其他支付方式",
    "哪个资产发生了转移",
    "哪些退款和消费者保护规则适用",
  ]) expect(flat).toContain(phrase);
});

test("adoption evidence stays within the measured population", () => {
  for (const phrase of [
    "发布协议不等于生产环境已经采用",
    "不能放在同一条增长曲线上",
    "内部实验",
    "186 笔交易",
    "略高于 4,000 美元",
    "不能据此推断总体需求、商户接受度、欺诈损失或整个经济体的市场份额",
    "符合条件的用户",
    "尝试下单数",
    "接受订单数",
    "履约、退款、争议和损失",
    "有边界的实验可以提出测量问题，不能直接给出市场预测",
  ]) expect(flat).toContain(phrase);
  for (const stale of [
    "超过一亿笔付款",
    "一万亿美元",
    "全球零售额的两成以上",
  ]) expect(flat).not.toContain(stale);
});

test("the operating contract covers authority order control evidence and recovery", () => {
  for (const phrase of [
    "权限",
    "订单",
    "控制",
    "证据",
    "恢复",
    "累计预算",
    "单笔限额",
    "预留、提交和释放规则",
    "认证请求",
    "付款状态",
    "履约状态",
    "保留期限",
    "超时负责人",
    "对账流程",
    "取消期限",
    "退款路径",
    "争议路径",
    "重复投递",
    "结账期间撤销授权",
    "批准后报价发生变化",
    "清算后交付失败",
    "预算周期结束后的退款",
    "无法对结果分类时，智能体应停止或升级处理",
    "模型仍是这份契约内不受信任的规划器",
  ]) expect(flat).toContain(phrase);
});

test("the contested boundary keeps settlement acceptance and accountability separate", () => {
  for (const phrase of [
    "清算",
    "信用、消费者保护和成熟的争议处理机制",
    "针对明确用途比较总成本与恢复能力，不能只比较手续费",
    "接受",
    "每个商户仍会执行自身策略",
    "问责",
    "谁在何时作出了什么声明",
    "合同法、消费者法、支付法和代理法",
    "协议可以让记录更清楚，却不能决定适用规则",
  ]) expect(flat).toContain(phrase);
});

test("the constraint handoff treats the model as an untrusted planner", () => {
  for (const phrase of [
    "下层约束来自安全",
    "请求签名认证的是密钥，不是安全模型",
    "授权书缩小了权限范围",
    "遭到提示词注入或入侵的智能体",
    "本地授权、小额预算、幂等控制、独立效果回执和恢复状态",
    "有效权限是授权与策略的交集",
    "不是发出请求的智能体有多自信",
  ]) expect(flat).toContain(phrase);
});

test("the Chinese chapter uses only the current English artifacts", () => {
  expect(chinese).toContain("fig-agent-economy-landscape");
  expect(chinese.match(/```\{dot\}/g)?.length).toBe(1);
  expect(chinese.match(/^\$\$/gm)?.length).toBe(4);
  expect(chinese.match(/::: \{\.callout-important\}/g)?.length).toBe(1);
  expect(chinese.match(/::: \{\.callout-tip\}/g)?.length).toBe(1);
  expect(chinese).not.toContain(":::: {.runnable}");
  expect(chinese).not.toContain("human irrational");
  expect(chinese).not.toContain("—");
});

test("the localized transaction path parses and fits the mobile reading column", async () => {
  const blocks = [...chinese.matchAll(/```\{dot\}\n([\s\S]*?)\n```/g)];
  expect(blocks.length).toBe(1);
  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(blocks[0][1]), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
  for (const label of [
    "委托人",
    "智能体工作负载",
    "商户",
    "支付服务商",
    "证据账本",
  ]) expect(blocks[0][1]).toContain(label);
});

test("the complete Chinese chapter renders through its final handoff", async () => {
  const graphviz = await loadGraphviz();
  const ctx: RenderContext = {
    bib: { entries: new Map(), cited: new Set() },
    xref: new Map(),
    currentHref: "ecosystem/agent-economy.html",
    chapterTitle: "智能体经济：身份、委托与机器支付",
    chapterNum: "80",
    prefix: "../",
    graphviz,
    lang: "zh",
    glossary: new Map(),
    glossarySeen: new Set(),
    glossaryUsed: new Set(),
    glossaryFirstUses: new Map(),
  };
  const { html, headings: renderedHeadings } = renderMarkdown(chinese, ctx);
  expect(html).not.toContain("```rdrdot");
  expect(html).not.toContain("katex-error");
  expect(html).toContain("付费智能体是一条交易路径，不是新的法律主体");
  expect(html.match(/<figure/g)?.length).toBe(1);
  expect(renderedHeadings.some(({ text }) => text === "延伸阅读")).toBeTrue();
});
