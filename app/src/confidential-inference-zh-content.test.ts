import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { loadGraphviz, withNodeMargin } from "./pipeline/diagrams.ts";

const english = readFileSync(
  new URL("../../en/safety/07-confidential-inference.qmd", import.meta.url),
  "utf8",
);
const chapter = readFileSync(
  new URL("../../zh/safety/07-confidential-inference.qmd", import.meta.url),
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

function tableCount(source: string): number {
  return [...source.matchAll(/^\|.+\|\n\|(?:\s*:?-+:?\s*\|)+$/gm)].length;
}

test("Chapter 60 preserves the complete English confidential-serving contract", () => {
  expect(headings(chapter, 1)).toEqual([
    "机密推理：可信执行与私密服务 {#sec-confidential-inference}",
  ]);
  expect(headings(chapter, 2)).toEqual([
    "先明确资产与对手",
    "追踪每一份明文副本",
    "验证是一次发布决策",
    "不同 CPU TEE 划出的边界并不相同",
    "GPU 会形成复合边界",
    "密钥发布闭合整条链路",
    "已发布系统只是案例",
    "衡量成本，不虚构通用数字",
    "替代方案改变信任与成本",
    "明确剩余风险",
    "保留运行记录",
    "争议所在",
    "下层约束",
    "机密性属于完整路径，而不是某种产品",
    "延伸阅读",
  ]);
  expect(headings(chapter, 3)).toEqual(["回归场景"]);
  expect(displayMath(chapter).map(canonicalMath)).toEqual(
    displayMath(english).map(canonicalMath),
  );
  expect(citationsAndCrossrefs(chapter)).toEqual(citationsAndCrossrefs(english));
  expect(chapter.match(/^```\{dot\}$/gm)?.length).toBe(1);
  expect(chapter.match(/^```yaml$/gm)?.length).toBe(1);
  expect(htmlFigureIds(chapter)).toEqual(htmlFigureIds(english));
  expect(tableCount(chapter)).toBe(tableCount(english));
  expect(chapter).not.toContain(".runnable");
});

test("the opening defines three distinct end-to-end properties", () => {
  for (const phrase of [
    "机密推理是一次服务会话的端到端属性",
    "声明的资产在请求处理期间始终留在声明的边界内",
    "传输加密保护移动中的数据",
    "隔离执行保护获准代码处理的明文",
    "远程证明提供目标环境的证据",
    "并不能证明获准应用本身安全",
    "TEE 只是设计中的一个组件，不是整个设计",
    "必须描述一个具体部署",
    "合同、访问控制、留存规则和审计可以补充这套设计",
  ]) expect(flat).toContain(phrase);
});

test("the threat model separates owners assets actors and exclusions", () => {
  for (const phrase of [
    "受保护的资产通常属于不同主体",
    "提示、检索上下文、输出和账户标识符",
    "权重、适配器和系统指令",
    "激活值、@gls-kv-cache、分词器状态和密码密钥",
    "资产所有者、发布策略和获准接收方",
    "网络观察者",
    "云管理员",
    "恶意虚拟机监控器或宿主操作系统",
    "共享硬件的其他租户",
    "服务应用运营者",
    "硬件厂商和验证方",
    "客户端终端",
    "明确排除项",
  ]) expect(flat).toContain(phrase);
});

test("the actor table keeps every protection boundary explicit", () => {
  for (const phrase of [
    "参与方或情形",
    "需要建模的能力",
    "机密路径可能保护什么",
    "仍需其他控制处理什么",
    "读取时序、长度、端点和加密数据包",
    "TEE 威胁模型范围内的 CPU 私有状态和内存",
    "产品特定的侧信道防御和部署隔离",
    "透明度、审查、授权和出口控制",
    "信任根多样性、本地验证和司法辖区清单",
    "加密前和展示后的内容均不受保护",
  ]) expect(flat).toContain(phrase);
});

test("the plaintext inventory follows every primary and secondary copy", () => {
  for (const phrase of [
    "从实际的 TLS 终止点开始",
    "负载均衡器或中继",
    "分词器和其他预处理",
    "调度器、CPU 缓冲区、加速器传输、设备内存",
    "GPU 之间的链路",
    "后处理、安全过滤器和响应加密",
    "工具调用、遥测、日志、崩溃转储、缓存、存储和备份",
    "某个阶段在声明边界之外看到明文",
    "更强的机密性主张就止步于此",
  ]) expect(flat).toContain(phrase);
});

test("the stepper turns confidentiality into six reviewable decisions", () => {
  for (const phrase of [
    'data-chip="资产" data-title="1 · 列出所有受保护值"',
    'data-chip="路径" data-title="2 · 端到端追踪明文"',
    'data-chip="证据" data-title="3 · 明确证据覆盖的主张"',
    'data-chip="验证" data-title="4 · 评估新鲜证据"',
    'data-chip="发布" data-title="5 · 把密钥绑定到决策"',
    'data-chip="运行" data-title="6 · 撤销并重新测试"',
    "六项相互衔接的决策",
  ]) expect(chapter).toContain(phrase);
});

test("attestation preserves the RATS roles and bounded evidence meaning", () => {
  for (const phrase of [
    "证明方",
    "目标环境",
    "证据",
    "验证方",
    "背书信息",
    "参考值",
    "证据评估策略",
    "证明结果",
    "依赖方",
    "证明方不能自行决定自己的状态是否可接受",
    "度量值是对所覆盖字节、元数据或事件的摘要承诺",
    "不能证明源代码身份",
    "不能证明语义行为",
  ]) expect(flat).toContain(phrase);
});

test("fresh evidence binds an endpoint key and rejects evidence substitution", () => {
  for (const phrase of [
    "$E$ 表示证据",
    "$n$ 是新鲜随机数",
    "$m$ 是启动时或运行时度量值",
    "$pk_E$ 是该端点的临时公钥",
    "证书链和签名",
    "TCB 状态和最低安全版本",
    "撤销状态",
    "CPU、每个必要的加速器和每个受保护交换机属于同一会话和拓扑",
    "随机数可以防止证明报文重放",
    "混搭证据、布谷鸟攻击和中继攻击",
  ]) expect(flat).toContain(phrase);
});

test("CPU TEE families retain their distinct boundaries", () => {
  for (const phrase of [
    "TEE 是一类技术，不代表统一保证",
    "SGX 隔离区页面和状态",
    "SEV-SNP 机密虚拟机的私有页面和状态",
    "TDX 信任域的私有内存和状态",
    "Arm Realm 的内存和状态",
    "防护对象",
    "未覆盖范围",
    "集成要求",
    "产品威胁模型、固件状态、微码、安全公告、撤销状态和侧信道防护",
  ]) expect(flat).toContain(phrase);
});

test("GPU confidentiality composes independent evidence roots and links", () => {
  for (const phrase of [
    "CPU 机密虚拟机不会自动覆盖加速器",
    "并行的证据根",
    "复合证明",
    "GPU 身份、机密模式配置、VBIOS 和固件度量值",
    "IOMMU 策略和独占设备分配",
    "CPU 到 GPU 的链路",
    "GPU 到 GPU 的链路",
    "HBM 中保存的是明文",
    "每个必要交换机以及预期的 GPU 与交换机拓扑",
    "拓扑变化是安全相关变更",
  ]) expect(flat).toContain(phrase);
});

test("key release binds policy identity lifecycle and failure closure", () => {
  for (const phrase of [
    "只有在决策真正控制某项秘密或服务的访问权时",
    "密钥代理、KMS 或客户端",
    "租户、用途、工作负载度量值、模型和数据版本",
    "证据缺失、过期、处于调试模式、已撤销或彼此不一致",
    "一律拒绝发布密钥",
    "补丁、模型替换、扩缩容、迁移、拓扑变更或验证策略变更",
    "重新证明",
    "轮换或撤销密钥",
    "重置并清除设备内存",
  ]) expect(flat).toContain(phrase);
});

test("published systems remain bounded vendor case studies", () => {
  for (const phrase of [
    "厂商自行陈述的设计，不是独立认证",
    "Apple Private Cloud Compute",
    "无状态处理、可强制执行的保证、无特权数据访问、不可定向和可验证透明度",
    "系统属性来自整体设计选择，而不是某一块芯片",
    "Meta 的 Private Processing",
    "RA-TLS、匿名 HTTP 中继、透明度记录、产物到期和撤销",
    "Google 的 Private AI Compute",
    "不能把它描述成与 Apple 相同的客户端验证路径",
    "AWS Nitro Enclaves",
  ]) expect(flat).toContain(phrase);
});

test("performance claims use a reproducible decomposition and workload", () => {
  for (const phrase of [
    "机密模式只给部分路径增加工作",
    "$T_{\\mathrm{base}}$ 是基准请求时间",
    "$T_{\\mathrm{CC}}$ 是机密配置下的请求时间",
    "同一硬件、同一模型、精度、批次、上下文长度、输出长度",
    "加速器拓扑、服务引擎、并发度、填充方式和预热状态",
    "吞吐量、首词元延迟、词元间延迟、p99",
    "启动和证明时间、受保护内存容量，以及失败或重试行为",
    "不是适用于所有模型或部署的常数",
  ]) expect(flat).toContain(phrase);
});

test("alternatives change both trust and cost without false rankings", () => {
  for (const phrase of [
    "TEE 把信任转移到硬件、固件、背书信息、参考值和验证策略",
    "多方安全计算把信任分散给多个参与方",
    "全同态加密允许服务器在不接收输入明文的情况下计算",
    "不能把某一种 Transformer 和序列形状的结果写成通用开销倍数",
    "完整性，而不是提示机密性",
    "差分隐私处理训练隐私和训练记录的影响",
    "本地部署缩短了服务提供商路径",
  ]) expect(flat).toContain(phrase);
});

test("residual risks cover every disclosure and availability class", () => {
  for (const phrase of [
    "流量分析",
    "侧信道和物理范围",
    "恶意的获准代码",
    "输出外泄和工具外泄",
    "回滚和密封状态",
    "供应链和验证",
    "终端失陷和可用性",
    "度量不等于代码审查",
    "TEE 既不会加固客户端，也不保证服务可用",
  ]) expect(flat).toContain(phrase);
});

test("the operating record ties evidence and key release to the accepted policy", () => {
  for (const field of [
    "protected_assets_and_data_classes",
    "threat_model_and_explicit_exclusions",
    "plaintext_path_and_boundary_inventory",
    "workload_measurement_and_source_revision",
    "attestation_format_and_verifier_policy",
    "endorsements_reference_values_and_tcb_status",
    "freshness_and_session_key_binding",
    "cpu_gpu_switch_topology_and_link_protection",
    "image_model_data_and_key_revisions",
    "key_release_rotation_and_revocation",
    "ingress_egress_logging_and_storage_paths",
    "rollout_rollback_reset_and_scrub_policy",
    "side_channel_and_traffic_analysis_controls",
    "benchmark_workload_and_overhead_results",
    "verification_and_exception_owner",
  ]) expect(chapter).toContain(field);
  for (const phrase of [
    "机器可读、带有版本",
    "与实际触发密钥发布的策略关联",
    "记录被拒绝的证据和策略例外",
    "记录本身可能暴露软件版本、基础设施布局或数据类别",
  ]) expect(flat).toContain(phrase);
});

test("regressions cover evidence topology application operations and recovery", () => {
  for (const phrase of [
    "证明报文重放、过期 TCB、已撤销固件、度量值不匹配和未绑定的会话密钥",
    "边界外终止 TLS、未经证明的 GPU、来自不同会话的 CPU 与 GPU 证据",
    "明文 GPU 链路",
    "获准调试镜像、崩溃转储或日志副本、模型替换和定向中继",
    "流量长度泄露、密封状态回滚、工具外泄和验证方故障",
    "验证方故障不能悄悄变成“允许”",
    "修补后的节点不能继承被替换节点的授权",
  ]) expect(flat).toContain(phrase);
});

test("contested questions and lower-layer limits stay explicit", () => {
  for (const phrase of [
    "客户端应该执行多少验证工作",
    "哪些剩余信道可以接受",
    "什么时候应该用密码学替代硬件信任",
    "硬件层和编排层决定服务层所能提出的最强主张",
    "CPU TEE 无法证明它没有覆盖的加速器",
    "GPU 机密模式无法保护边界之外的 TLS 终止点、日志或工具",
    "从未被度量的模型版本",
    "不能扩大证据实际表达的范围",
  ]) expect(flat).toContain(phrase);
});

test("the conclusion defines confidentiality as an operated path", () => {
  for (const phrase of [
    "可靠的部署从资产和对手出发",
    "盘点每一份明文副本",
    "组合新鲜的 CPU 与加速器证据",
    "绑定端点密钥",
    "由依赖方控制密钥发布",
    "版本下限会变化，固件会被撤销，拓扑会调整，模型会更新",
    "只有完整路径、验证策略、发布协议和运行纪律",
  ]) expect(flat).toContain(phrase);
});

test("categorical legacy framing and invented benchmark code are absent", () => {
  for (const phrase of [
    "机器里没有任何东西强制执行",
    "提示词对机器的运营者都是可读的",
    "传票就能强制交出",
    "这个问题还是对称的",
    "硅片为这套软件栈签了字",
    "明文孤岛只有两个硅片封装",
    "典型 LLM 负载的吞吐损失低于 5%",
    "随模型增大、批次拉长而趋近于零",
    "替代方案输在成本上",
    "MPC 接近一万倍",
    "FHE 超过十万倍",
    "唯一与生产服务兼容的点",
    "所有已出货的信任根都属于美国公司",
    "compute_per_tok",
    "xfer_per_req",
    "tax = 0.35",
  ]) expect(flat).not.toContain(phrase);
  expect(chapter).not.toContain("—");
});

test("the localized attestation diagram fits the mobile reading column", async () => {
  const block = chapter.match(/```\{dot\}\n([\s\S]*?)\n```/)?.[1];
  expect(block).toBeDefined();
  const graphviz = await loadGraphviz();
  const svg = graphviz.dot(withNodeMargin(block!), "svg");
  const widthPt = Number(svg.match(/<svg width="([\d.]+)pt"/)?.[1]);
  expect(widthPt).toBeLessThanOrEqual(235);
});
