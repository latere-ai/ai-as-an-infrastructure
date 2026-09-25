// A reference architecture for an LLM application stack, by layer: clients,
// the app and agent runtime, retrieval, the tool plane (MCP gateway and tool
// servers), the sandbox and its egress proxy, the model gateway, providers
// (hosted APIs and self-hosted serving), compute, and observability with
// evaluation. Arrows are calls; each arrow's color is the credential the call
// carries, so the figure answers where each kind of secret travels: provider
// secrets appear only on the gateway's hop to a provider and on the egress
// proxy's hop to an allowlisted host. Telemetry is a dashed bus into the trace
// store; a trace correlates events and grants no authority.
//
// Selecting a component shows what it does, example projects and products,
// the section of this chapter that covers its seam, and each call in and out with
// its credential. With no component selected the readout groups every hop by
// the credential it carries.
//
// The components, calls, and credential assignments restate the chapter's
// prose. The example projects are illustrative, not recommendations, and were
// checked on 24 September 2026 against each project's own documentation or
// repository; the chapter's dated blocks cite them:
// - gateways: github.com/BerriAI/litellm, github.com/agentgateway/agentgateway
//   (LLM, MCP, and A2A gateway), github.com/theagentrouter/agent-router
//   (Agent Router, formerly Envoy AI Gateway, with MCP support),
//   github.com/Portkey-AI/gateway, github.com/maximhq/bifrost,
//   openrouter.ai/pricing, developers.cloudflare.com/ai-gateway/
// - sandboxes: github.com/e2b-dev/runtime and vercel.com/docs/sandbox
//   (Firecracker microVMs), modal.com/docs/guide/security (gVisor)
// - serving: github.com/vllm-project/vllm, github.com/sgl-project/sglang,
//   github.com/llm-d/llm-d, github.com/ai-dynamo/dynamo
// - runtimes and retrieval: openai.github.io/openai-agents-python,
//   github.com/anthropics/claude-agent-sdk-python, LangGraph checkpointers,
//   Pydantic AI durable execution, github.com/pgvector/pgvector, Qdrant hybrid
//   queries, turbopuffer.com/docs
// - compute: Kueue, Volcano, and KAI Scheduler repositories, KubeRay, Slurm
// - evaluation: Langfuse, Arize Phoenix, Promptfoo, DeepEval, Braintrust, and
//   LangSmith documentation

import { defineFigure, type Lang, type State, type Text } from "./types.ts";
import { svg, el, text, g } from "./lib/svg.ts";
import { C, TYPE } from "./lib/theme.ts";
import { textWidth } from "./lib/labels.ts";
import { wrapLines } from "./lib/wrap-lines.ts";
import { tpl } from "./lib/format.ts";

// ---------------------------------------------------------------- model

type Id =
  | "clients" | "runtime" | "retriever" | "store" | "mcpgw" | "toolsrv" | "sandbox" | "egress"
  | "gateway" | "hosted" | "serving" | "compute" | "traces" | "evals" | "dataset";
type Layer = "clients" | "runtime" | "retrieval" | "tools" | "sandbox" | "gateway" | "providers" | "compute" | "observe";
type Contract = "admission" | "operation" | "toolpath" | "evidence" | "telemetry" | "accounting" | "tests";
type Cred = "session" | "exchanged" | "vkey" | "secret" | "workload" | "none";

interface Comp {
  id: Id;
  layer: Layer;
  name: Text;
  examples: Text; // short list drawn in the box
  more: Text; // the readout's example line
  does: Text;
  contracts: Contract[];
  spans?: boolean; // exports OTel GenAI spans (drawn as a stub on the bus when on the left edge)
}

const COMPS: readonly Comp[] = [
  {
    id: "clients", layer: "clients",
    name: { en: "Clients", zh: "客户端" },
    examples: { en: "web and mobile apps, IDE and CLI agents, CI jobs", zh: "网页与移动应用、IDE 与命令行智能体、CI 任务" },
    more: { en: "Product front ends, coding agents such as Claude Code and Codex, and CI pipelines that run evaluations.", zh: "产品前端、Claude Code 和 Codex 等编码智能体，以及运行评测的 CI 流水线。" },
    does: { en: "Where requests start. Each caller signs in with the organization's identity provider, and the session names a user and a tenant that every later hop derives its authority from.", zh: "请求的起点。每个调用方都通过组织的身份提供方登录，会话标明用户和租户，之后每一跳的权限都从这里推导。" },
    contracts: ["admission"],
  },
  {
    id: "runtime", layer: "runtime",
    name: { en: "App and agent runtime", zh: "应用与智能体运行时" },
    examples: { en: "OpenAI Agents SDK, Claude Agent SDK, LangGraph, Pydantic AI", zh: "OpenAI Agents SDK、Claude Agent SDK、LangGraph、Pydantic AI" },
    more: { en: "OpenAI Agents SDK, Claude Agent SDK, LangGraph with a Postgres checkpointer, Pydantic AI with durable execution.", zh: "OpenAI Agents SDK、Claude Agent SDK、带 Postgres 检查点的 LangGraph、带持久化执行的 Pydantic AI。" },
    does: { en: "Runs the agent loop: assembles context, calls the model, collects tool proposals, and keeps durable state in a checkpointer so a task survives a restart. It owns the logical operation, its deadline, and its cancellation.", zh: "运行智能体循环：组装上下文、调用模型、收集工具提议，并用检查点保存持久状态，让任务在重启后还能继续。逻辑操作及其截止时间和取消都由它负责。" },
    contracts: ["operation"],
    spans: true,
  },
  {
    id: "retriever", layer: "retrieval",
    name: { en: "Retrieval service", zh: "检索服务" },
    examples: { en: "BM25 plus dense search, rank fusion, rerank", zh: "BM25 与稠密检索、排名融合、重排" },
    more: { en: "Hybrid queries in Qdrant or in Postgres with pgvector, fused by reciprocal rank; Cohere Rerank or an open reranker called through the gateway.", zh: "在 Qdrant 或带 pgvector 的 Postgres 中执行混合查询，用倒数排名融合合并结果；Cohere Rerank 或开源重排模型通过网关调用。" },
    does: { en: "Answers a query with identified evidence: lexical and dense search fused by rank, then a reranker. Authorization is applied before candidates leave the service, and the embedding and rerank models are called through the gateway.", zh: "用带标识的证据回答查询：词法检索和稠密检索按排名融合，再交给重排模型。候选文档离开服务之前先完成授权，嵌入和重排模型都通过网关调用。" },
    contracts: ["evidence"],
    spans: true,
  },
  {
    id: "store", layer: "retrieval",
    name: { en: "Vector and text index", zh: "向量与全文索引" },
    examples: { en: "pgvector, Qdrant, turbopuffer", zh: "pgvector、Qdrant、turbopuffer" },
    more: { en: "Postgres with pgvector (and pgvectorscale), Qdrant, turbopuffer, or a managed vector database.", zh: "带 pgvector（以及 pgvectorscale）的 Postgres、Qdrant、turbopuffer，或托管向量数据库。" },
    does: { en: "Holds document chunks, their embeddings, and a full-text index, with the tenant in every key and every filter.", zh: "保存文档块、嵌入向量和全文索引，每个键和每个过滤条件都带有租户。" },
    contracts: ["evidence"],
  },
  {
    id: "mcpgw", layer: "tools",
    name: { en: "MCP gateway", zh: "MCP 网关" },
    examples: { en: "agentgateway, Agent Router", zh: "agentgateway、Agent Router" },
    more: { en: "agentgateway or Agent Router (formerly Envoy AI Gateway) in front of remote MCP servers; both also carry model traffic, so one proxy can fill both gateway boxes.", zh: "放在远程 MCP 服务器前面的 agentgateway 或 Agent Router（原名 Envoy AI Gateway）；两者也能承载模型流量，因此一个代理可以同时承担两个网关的角色。" },
    does: { en: "The single entry for tool traffic. It authenticates the caller, checks the selected tool against an allowlist, brokers a least-privilege credential for the target, and records intent and receipt.", zh: "工具流量的唯一入口。它验证调用方身份，按白名单检查所选工具，为目标换取最小权限凭据，并记录意图和回执。" },
    contracts: ["toolpath"],
  },
  {
    id: "toolsrv", layer: "tools",
    name: { en: "Tool servers", zh: "工具服务器" },
    examples: { en: "GitHub, Playwright, database MCP servers", zh: "GitHub、Playwright、数据库等 MCP 服务器" },
    more: { en: "One MCP server per system: the GitHub MCP server, Playwright MCP for a browser, a database server, and internal APIs wrapped the same way.", zh: "每个系统一台 MCP 服务器：GitHub MCP 服务器、驱动浏览器的 Playwright MCP、数据库服务器，以及用同样方式封装的内部 API。" },
    does: { en: "Each server exposes one system, such as a code host, a browser, or a database, and authorizes its own resources. A tool annotation is untrusted metadata and cannot show that a call is safe.", zh: "每台服务器暴露一个系统，例如代码托管平台、浏览器或数据库，并对自己的资源单独授权。工具注解只是不受信任的元数据，无法证明某次调用安全。" },
    contracts: ["toolpath"],
  },
  {
    id: "sandbox", layer: "sandbox",
    name: { en: "Sandbox", zh: "沙箱" },
    examples: { en: "E2B, Modal, Vercel Sandbox; Firecracker, gVisor", zh: "E2B、Modal、Vercel Sandbox；Firecracker、gVisor" },
    more: { en: "Hosted: E2B and Vercel Sandbox, each sandbox a Firecracker microVM; Modal, whose compute runs under gVisor. Self-hosted: Firecracker or gVisor on the stack's own nodes.", zh: "托管：E2B 和 Vercel Sandbox，每个沙箱都是一台 Firecracker microVM；Modal，其计算任务运行在 gVisor 之下。自托管：在自有节点上运行 Firecracker 或 gVisor。" },
    does: { en: "Runs model-written code in a microVM or a userspace kernel, with bounded CPU, memory, disk, wall-clock time, and processes, and no network except through the egress proxy.", zh: "在 microVM 或用户态内核中运行模型写出的代码，限制 CPU、内存、磁盘、实际运行时间和进程数，除经出站代理之外没有网络访问。" },
    contracts: ["toolpath"],
  },
  {
    id: "egress", layer: "sandbox",
    name: { en: "Egress proxy", zh: "出站代理" },
    examples: { en: "to allowlisted hosts only; DNS and redirect checks; secret substitution", zh: "只通往白名单主机；DNS 与重定向检查；密钥替换" },
    more: { en: "A forward proxy or network policy that allows listed hosts only; hosted sandboxes offer the same control as a configuration.", zh: "只放行白名单主机的正向代理或网络策略；托管沙箱以配置项的形式提供同样的控制。" },
    does: { en: "The sandbox's only path out. It allows listed destinations, resolves and checks DNS and every redirect, blocks private and metadata addresses, and replaces the placeholder the sandbox holds with the real secret.", zh: "沙箱唯一的出网路径。它只放行白名单中的目标，解析并检查 DNS 和每一次重定向，阻止私有地址和元数据地址，并把沙箱持有的占位符替换成真正的密钥。" },
    contracts: ["toolpath"],
  },
  {
    id: "gateway", layer: "gateway",
    name: { en: "Model gateway", zh: "模型网关" },
    examples: { en: "LiteLLM, agentgateway, Agent Router, Portkey, Bifrost; managed: OpenRouter, Cloudflare", zh: "LiteLLM、agentgateway、Agent Router、Portkey、Bifrost；托管：OpenRouter、Cloudflare" },
    more: { en: "Self-hosted: LiteLLM, agentgateway, Agent Router (formerly Envoy AI Gateway), Portkey, Bifrost. Managed: OpenRouter, Cloudflare AI Gateway, or Portkey's hosted gateway.", zh: "自托管：LiteLLM、agentgateway、Agent Router（原名 Envoy AI Gateway）、Portkey、Bifrost。托管：OpenRouter、Cloudflare AI Gateway，或 Portkey 的托管网关。" },
    does: { en: "One address for every model call. It translates between API dialects, admits requests under budgets and policy, routes and falls back among providers, and holds the provider secrets; callers hold virtual keys.", zh: "所有模型调用共用的一个地址。它在不同 API 方言之间转换，按预算和策略决定是否接纳请求，在提供商之间路由和回退，并保管提供商密钥；调用方只持有虚拟密钥。" },
    contracts: ["admission", "operation"],
    spans: true,
  },
  {
    id: "hosted", layer: "providers",
    name: { en: "Hosted model APIs", zh: "托管模型 API" },
    examples: { en: "Anthropic, OpenAI, Google; or through a cloud", zh: "Anthropic、OpenAI、Google；或经云平台" },
    more: { en: "First-party APIs from Anthropic, OpenAI, and Google, or the same models through Amazon Bedrock, Google Vertex AI, or Microsoft Foundry.", zh: "Anthropic、OpenAI 和 Google 的一方 API，或经 Amazon Bedrock、Google Vertex AI、Microsoft Foundry 访问的同一批模型。" },
    does: { en: "Frontier models behind a provider's API. Batching, caching, and accelerators belong to the provider; the stack sees prices, rate limits, and a capability profile per model.", zh: "位于提供商 API 之后的前沿模型。批处理、缓存和加速器都归提供商管理；技术栈看到的是每个模型的价格、限流和能力说明。" },
    contracts: ["operation"],
  },
  {
    id: "serving", layer: "providers",
    name: { en: "Self-hosted serving", zh: "自托管推理服务" },
    examples: { en: "vLLM, SGLang; llm-d or Dynamo at scale", zh: "vLLM、SGLang；规模化时用 llm-d 或 Dynamo" },
    more: { en: "vLLM or SGLang behind an OpenAI-compatible endpoint (vLLM also serves the Anthropic Messages API); llm-d or NVIDIA Dynamo for cache-aware routing and disaggregated serving across many replicas.", zh: "对外提供 OpenAI 兼容端点的 vLLM 或 SGLang（vLLM 也提供 Anthropic Messages API）；副本很多时，用 llm-d 或 NVIDIA Dynamo 做感知缓存的路由和分离式服务。" },
    does: { en: "Open-weight or fine-tuned models on the stack's own GPUs, with continuous batching and prefix caching. It reports overload as 429 or 503 and streams typed events like any provider.", zh: "在自有 GPU 上运行开源权重模型或微调模型，使用连续批处理和前缀缓存。过载时返回 429 或 503，并像其他提供商一样输出带类型的事件流。" },
    contracts: ["operation"],
    spans: true,
  },
  {
    id: "compute", layer: "compute",
    name: { en: "GPU compute and schedulers", zh: "GPU 算力与调度器" },
    examples: { en: "Kubernetes with Kueue, Volcano, or KAI; Slurm; Ray", zh: "带 Kueue、Volcano 或 KAI 的 Kubernetes；Slurm；Ray" },
    more: { en: "Kubernetes with Kueue quotas and gang scheduling (Volcano or KAI Scheduler), Slurm, or Ray on KubeRay; capacity rented by use from Modal, Baseten, Fireworks, or Together, or committed ahead from a neocloud such as CoreWeave or Lambda.", zh: "带 Kueue 配额和成组调度（Volcano 或 KAI Scheduler）的 Kubernetes、Slurm，或运行在 KubeRay 上的 Ray；算力可以按用量从 Modal、Baseten、Fireworks 或 Together 租用，也可以向 CoreWeave、Lambda 等新型云提前承诺用量。" },
    does: { en: "GPUs and the schedulers that place serving replicas and training jobs, with quotas and all-or-nothing admission for jobs that need many GPUs at once.", zh: "GPU，以及安排服务副本和训练任务的调度器；需要同时占用多块 GPU 的任务按配额和全有或全无的方式准入。" },
    contracts: ["accounting"],
  },
  {
    id: "traces", layer: "observe",
    name: { en: "Traces", zh: "追踪" },
    examples: { en: "Langfuse, Phoenix, any OTel backend", zh: "Langfuse、Phoenix、任意 OTel 后端" },
    more: { en: "Langfuse or Arize Phoenix, or a general OpenTelemetry backend such as Grafana or Datadog receiving the same GenAI spans.", zh: "Langfuse 或 Arize Phoenix，也可以是接收同一套 GenAI span 的通用 OpenTelemetry 后端，例如 Grafana 或 Datadog。" },
    does: { en: "Stores the trace of every operation as OTel GenAI spans: model calls, retrievals, tool calls, tokens, cost, and route decisions. A trace correlates events and grants nothing.", zh: "以 OTel GenAI span 保存每项操作的追踪记录，包括模型调用、检索、工具调用、词元、成本和路由决策。追踪只负责关联事件，不授予任何权限。" },
    contracts: ["telemetry"],
  },
  {
    id: "evals", layer: "observe",
    name: { en: "Evaluation and judge", zh: "评测与裁判" },
    examples: { en: "Promptfoo, DeepEval, Braintrust, LangSmith", zh: "Promptfoo、DeepEval、Braintrust、LangSmith" },
    more: { en: "Promptfoo or DeepEval in CI; Braintrust or LangSmith as hosted evaluation; a judge from a different model family than the one under test.", zh: "在 CI 中运行 Promptfoo 或 DeepEval；以 Braintrust 或 LangSmith 作为托管评测；裁判模型与被测模型来自不同的模型家族。" },
    does: { en: "Scores sampled traces and release candidates with assertions, reference metrics, and a calibrated judge model, called through the gateway on its own budget.", zh: "用断言、基于参考答案的指标和经过校准的裁判模型，为抽样追踪和候选版本打分；裁判模型通过网关调用，使用单独的预算。" },
    contracts: ["telemetry", "tests"],
  },
  {
    id: "dataset", layer: "observe",
    name: { en: "Regression set", zh: "回归数据集" },
    examples: { en: "failing traces promoted to fixtures", zh: "由失败追踪转成的测试用例" },
    more: { en: "Dataset features of the trace store or evaluation tool, or versioned fixture files next to the code.", zh: "追踪存储或评测工具自带的数据集功能，或与代码放在一起、带版本的测试用例文件。" },
    does: { en: "Failing production traces promoted into fixtures, so the next release is tested against the failures already seen.", zh: "把失败的生产追踪转成测试用例，让下一次发布针对已经出现过的失败接受检验。" },
    contracts: ["tests"],
  },
];
const byId = new Map(COMPS.map((c) => [c.id, c]));

interface Hop { from: Id; to: Id | "out"; call: Text; cred: Cred; detail: Text }
const HOPS: readonly Hop[] = [
  { from: "clients", to: "runtime", cred: "session", call: { en: "requests and streamed responses", zh: "请求与流式响应" }, detail: { en: "carries a session token from the identity provider", zh: "携带身份提供方签发的会话令牌" } },
  { from: "runtime", to: "retriever", cred: "exchanged", call: { en: "retrieval query", zh: "检索查询" }, detail: { en: "carries a token exchanged for the retrieval service, naming user and tenant", zh: "携带为检索服务交换所得的令牌，其中标明用户和租户" } },
  { from: "runtime", to: "mcpgw", cred: "exchanged", call: { en: "MCP over Streamable HTTP", zh: "基于 Streamable HTTP 的 MCP" }, detail: { en: "carries a token issued for the MCP gateway's audience", zh: "携带以 MCP 网关为受众签发的令牌" } },
  { from: "runtime", to: "sandbox", cred: "workload", call: { en: "create, run, destroy", zh: "创建、执行、销毁" }, detail: { en: "carries the runtime's service identity at the sandbox API", zh: "携带运行时在沙箱 API 上的服务身份" } },
  { from: "runtime", to: "gateway", cred: "vkey", call: { en: "model calls", zh: "模型调用" }, detail: { en: "carries a virtual key with a model allowlist, budget, and rate limit", zh: "携带设有模型白名单、预算和限流的虚拟密钥" } },
  { from: "retriever", to: "store", cred: "workload", call: { en: "hybrid query with a tenant filter", zh: "带租户过滤的混合查询" }, detail: { en: "carries the retrieval service's own identity", zh: "携带检索服务自己的服务身份" } },
  { from: "retriever", to: "gateway", cred: "vkey", call: { en: "embedding and rerank calls", zh: "嵌入与重排调用" }, detail: { en: "carries a virtual key limited to embedding and rerank models", zh: "携带只能调用嵌入和重排模型的虚拟密钥" } },
  { from: "mcpgw", to: "toolsrv", cred: "exchanged", call: { en: "authorized tool call", zh: "已授权的工具调用" }, detail: { en: "carries a least-privilege credential issued for that tool's audience", zh: "携带以该工具为受众签发的最小权限凭据" } },
  { from: "sandbox", to: "egress", cred: "none", call: { en: "outbound request", zh: "出站请求" }, detail: { en: "carries a placeholder, never the real secret", zh: "只携带占位符，不含真正的密钥" } },
  { from: "sandbox", to: "gateway", cred: "vkey", call: { en: "model calls from sandboxed code", zh: "沙箱内代码发起的模型调用" }, detail: { en: "carries a short-lived virtual key scoped to this sandbox", zh: "携带限定于本沙箱的短期虚拟密钥" } },
  { from: "egress", to: "out", cred: "secret", call: { en: "the request, with the secret added", zh: "补上密钥后的请求" }, detail: { en: "carries the static secret the proxy substitutes", zh: "携带代理替换进去的静态密钥" } },
  { from: "gateway", to: "hosted", cred: "secret", call: { en: "the provider's own API dialect", zh: "提供商自己的 API 方言" }, detail: { en: "carries the provider API key, held only by the gateway", zh: "携带只由网关保管的提供商 API 密钥" } },
  { from: "gateway", to: "serving", cred: "workload", call: { en: "OpenAI-compatible call", zh: "OpenAI 兼容调用" }, detail: { en: "carries an in-cluster service identity over mTLS", zh: "携带集群内基于 mTLS 的服务身份" } },
  { from: "serving", to: "compute", cred: "none", call: { en: "runs on scheduled GPUs", zh: "运行在调度分配的 GPU 上" }, detail: { en: "no request credential; the scheduler places the replicas", zh: "不携带请求凭据，由调度器安排副本位置" } },
  { from: "traces", to: "evals", cred: "workload", call: { en: "sampled traces", zh: "抽样追踪" }, detail: { en: "carries a read-only credential on the trace store", zh: "携带追踪存储上的只读凭据" } },
  { from: "evals", to: "gateway", cred: "vkey", call: { en: "judge calls", zh: "裁判调用" }, detail: { en: "carries its own virtual key with a separate budget", zh: "携带预算独立的专用虚拟密钥" } },
  { from: "evals", to: "dataset", cred: "workload", call: { en: "promote failing traces", zh: "转入失败追踪" }, detail: { en: "carries a credential that can write only to the regression set", zh: "携带只能写入回归数据集的凭据" } },
];

const CRED_ORDER: readonly Cred[] = ["session", "exchanged", "vkey", "secret", "workload", "none"];
const CRED_COLOR: Record<Cred, string> = { session: C.c1, exchanged: C.c2, vkey: C.c3, secret: C.c4, workload: C.c5, none: C.ink3 };
const CREDS: Record<Cred, Text> = {
  session: { en: "user session (OIDC)", zh: "用户会话（OIDC）" },
  exchanged: { en: "exchanged token, one audience", zh: "交换所得令牌，单一受众" },
  vkey: { en: "gateway virtual key", zh: "网关虚拟密钥" },
  secret: { en: "provider or static secret", zh: "提供商密钥或静态密钥" },
  workload: { en: "workload identity (mTLS)", zh: "工作负载身份（mTLS）" },
  none: { en: "no credential", zh: "不携带凭据" },
};

const LAYERS: Record<Layer, Text> = {
  clients: { en: "Clients", zh: "客户端" },
  runtime: { en: "App and agent runtime", zh: "应用与智能体运行时" },
  retrieval: { en: "Retrieval", zh: "检索" },
  tools: { en: "Tool plane", zh: "工具平面" },
  sandbox: { en: "Sandbox", zh: "沙箱" },
  gateway: { en: "Model gateway", zh: "模型网关" },
  providers: { en: "Providers", zh: "模型提供方" },
  compute: { en: "Compute", zh: "算力" },
  observe: { en: "Observability and evaluation", zh: "可观测性与评测" },
};

// Each contract names the section of the chapter that covers its seam.
const CONTRACTS: Record<Contract, Text> = {
  admission: { en: "admission, capability profiles, and routing (The model gateway)", zh: "准入、能力说明与路由（模型网关）" },
  operation: { en: "the model operation, with its retry, error, and overload rules (Operations, retries, and overload)", zh: "模型操作，以及相应的重试、错误与过载规则（操作、重试与过载）" },
  toolpath: { en: "the tool authorization path and effect receipts (The tool seam)", zh: "工具授权路径与操作回执（工具接缝）" },
  evidence: { en: "the retrieval evidence contract (Retrieval and evidence)", zh: "检索证据契约（检索与证据）" },
  telemetry: { en: "trace evidence (Telemetry as evidence)", zh: "追踪证据（作为证据的遥测）" },
  accounting: { en: "accounting for the accepted task, including build versus rent (The accepted task)", zh: "按合格任务核算，包括自建与租用的取舍（合格任务）" },
  tests: { en: "boundary tests and cutover (The integration release)", zh: "边界测试与切换（集成发布）" },
};

// ---------------------------------------------------------------- labels

const labels = {
  en: {
    title: "A reference stack by layer, with the credential each call carries",
    all: "Which credential each call carries",
    hint: "Select a component to see what it does, example choices, and the section of this chapter that covers its seam.",
    examplesHead: "Examples",
    governed: "Governed by {c}.",
    callsOut: "Calls out",
    callsIn: "Calls in",
    hopOut: "to {to}: {call}; {detail}",
    hopIn: "from {from}: {call}; {detail}",
    spans: "Exports OTel GenAI spans to the trace store; trace context carries no authority.",
    out: "allowlisted hosts",
    spansFrom: "dashed: OTel GenAI spans from every component",
    legend: "Arrow color is the credential the call carries",
    legendPhone: "Swatch color is the credential the call carries",
    telemetry: "telemetry, no authority",
    credLine: "{cred}: {list}",
    hopShort: "{from} to {to}",
    listSep: "; ",
    phoneOut: "to {to}: {cred}",
    phoneSpans: "to Traces: spans",
    describeAll: "A reference stack of {n} components in {l} layers. Provider and static secrets travel only from the model gateway to the providers and from the egress proxy to allowlisted hosts; every other call carries a user session, an exchanged token, a virtual key, or a workload identity.",
    describeOne: "{name}, in the {layer} layer. {does} Governed by {c}.",
    describeLayer: "{name}. {does} Governed by {c}.",
  },
  zh: {
    title: "按层划分的参考技术栈，以及每次调用携带的凭据",
    all: "每次调用携带什么凭据",
    hint: "选中一个组件，可以查看它的作用、可选的实现，以及本章讲述其接缝的小节。",
    examplesHead: "实现示例",
    governed: "约束它的是{c}。",
    callsOut: "向外调用",
    callsIn: "接收调用",
    hopOut: "到{to}：{call}；{detail}",
    hopIn: "来自{from}：{call}；{detail}",
    spans: "向追踪存储导出 OTel GenAI span；追踪上下文不携带任何权限。",
    out: "白名单主机",
    spansFrom: "虚线：各组件导出的 OTel GenAI span",
    legend: "箭头颜色表示该调用携带的凭据",
    legendPhone: "色块颜色表示该调用携带的凭据",
    telemetry: "遥测，不含权限",
    credLine: "{cred}：{list}",
    hopShort: "{from}到{to}",
    listSep: "；",
    phoneOut: "到{to}：{cred}",
    phoneSpans: "到追踪：span",
    describeAll: "一套由 {n} 个组件、{l} 层组成的参考技术栈。提供商密钥和静态密钥只出现在两处：模型网关到模型提供方，以及出站代理到白名单主机；其余调用携带的是用户会话、交换所得令牌、虚拟密钥或工作负载身份。",
    describeOne: "{name}，属于{layer}层。{does}约束它的是{c}。",
    describeLayer: "{name}。{does}约束它的是{c}。",
  },
};
type L = typeof labels.en;

type Sel = "all" | Id;
type P = { component: Sel };

const nameOf = (id: Id | "out", lang: Lang) => (id === "out" ? labels[lang].out : byId.get(id)!.name[lang]);
// In Chinese text a Latin word next to a CJK glyph takes a space on that side.
const latinEdge = /[A-Za-z0-9)]/;
const lead = (s: string, lang: Lang) => (lang === "zh" && latinEdge.test(s[0]) ? ` ${s}` : s);
const tail = (s: string, lang: Lang) => (lang === "zh" && latinEdge.test(s[s.length - 1]) ? `${s} ` : s);
const contractText = (c: Comp, lang: Lang) => c.contracts.map((k) => CONTRACTS[k][lang]).join(lang === "zh" ? "，以及" : " and ");
const touches = (h: Hop, id: Id) => h.from === id || h.to === id;

function describe(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const sel = st.p.component;
  if (sel === "all") return tpl(L.describeAll, { n: COMPS.length, l: Object.keys(LAYERS).length });
  const c = byId.get(sel)!;
  const same = LAYERS[c.layer][lang] === c.name[lang];
  return tpl(same ? L.describeLayer : L.describeOne, { name: c.name[lang], layer: LAYERS[c.layer][lang], does: c.does[lang], c: contractText(c, lang) });
}

// ---------------------------------------------------------------- boxes

interface Box { x0: number; x1: number; y0: number; y1: number; cx: number; cy: number }
type Pt = [number, number];

const PAD = 8;
const NAME = TYPE.label, EX = TYPE.small;
const NAME_LH = NAME + 4, EX_LH = EX + 4;

function boxLines(c: Comp, width: number, lang: Lang) {
  const inner = width - 2 * PAD;
  return { name: wrapLines(c.name[lang], NAME, inner), ex: wrapLines(c.examples[lang], EX, inner) };
}
const boxHeight = (ls: { name: string[]; ex: string[] }, extra = 0) =>
  PAD + ls.name.length * NAME_LH + 2 + ls.ex.length * EX_LH + extra + PAD - 4;

function drawBox(c: Comp, b: Box, lang: Lang, st: { sel: Sel; dim: boolean }, extraLines: string[] = []): string {
  const ls = boxLines(c, b.x1 - b.x0, lang);
  const isSel = st.sel === c.id;
  const parts: string[] = [];
  parts.push(el("rect", { x: b.x0, y: b.y0, width: b.x1 - b.x0, height: b.y1 - b.y0, rx: 6, fill: C.paper, stroke: isSel ? C.ink : C.rule, "stroke-width": isSel ? 2 : 1 }));
  let y = b.y0 + PAD + NAME - 1;
  for (const ln of ls.name) { parts.push(text(b.x0 + PAD, y, ln, { "font-size": NAME, class: "fig-t-strong" })); y += NAME_LH; }
  y += 2 - (NAME_LH - EX_LH) - 1;
  for (const ln of ls.ex) { parts.push(text(b.x0 + PAD, y, ln, { "font-size": EX, class: "fig-t-muted" })); y += EX_LH; }
  if (extraLines.length) parts.push(...extraLines);
  return g({ opacity: st.dim ? 0.5 : undefined, "data-fig-set": `component=${c.id}`, class: "fig-hit" }, ...parts);
}

function arrowHead(pts: Pt[], color: string): string {
  const [x1, y1] = pts[pts.length - 1];
  const [x0, y0] = pts[pts.length - 2];
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  const ux = (x1 - x0) / len, uy = (y1 - y0) / len;
  const s = 7, hw = 4;
  const bx = x1 - ux * s, by = y1 - uy * s;
  return el("path", { d: `M${x1},${y1}L${bx - uy * hw},${by + ux * hw}L${bx + uy * hw},${by - ux * hw}Z`, fill: color });
}

function trimmed(pts: Pt[], by = 6): Pt[] {
  const out = pts.map((p) => [...p] as Pt);
  const n = out.length;
  const [x1, y1] = out[n - 1], [x0, y0] = out[n - 2];
  const len = Math.hypot(x1 - x0, y1 - y0) || 1;
  out[n - 1] = [x1 - ((x1 - x0) / len) * by, y1 - ((y1 - y0) / len) * by];
  return out;
}

const pathOf = (pts: Pt[]) => pts.map(([x, y], i) => `${i ? "L" : "M"}${Math.round(x * 10) / 10},${Math.round(y * 10) / 10}`).join("");

function edge(pts: Pt[], color: string, on: boolean, dim: boolean, dashed = false): string {
  return g({ opacity: dim ? 0.22 : undefined },
    el("path", { d: pathOf(trimmed(pts)), fill: "none", stroke: color, "stroke-width": on ? 2.8 : 1.8, "stroke-dasharray": dashed ? "4 3" : undefined, "stroke-linejoin": "round" }),
    arrowHead(pts, color));
}

// ---------------------------------------------------------------- desktop layout

// Three columns between margins that hold the telemetry bus (left) and the
// egress arrow (right). Rows from the top: clients; the runtime across the
// width; the retrieval, tool-plane, and sandbox groups side by side; the model
// gateway across the width; the providers group; compute under self-hosted
// serving; the observability and evaluation group. Calls into the gateway from
// the runtime and the retrieval service run down the left gutter, the
// sandbox's down the right gutter, and the judge's up the center, between the
// two provider boxes.
const M = 20, GUT = 26, GAP = 28, CAP = 20, INSET = 8, INNER = 20;

interface Group { layer: Layer; x0: number; x1: number; y0: number; y1: number }

function desktop(w: number, lang: Lang) {
  const colW = (w - 2 * M - 2 * GUT) / 3;
  const col = (i: number): [number, number] => [M + i * (colW + GUT), M + i * (colW + GUT) + colW];
  const half = w / 2, HG = 10;
  const B = new Map<Id, Box>();
  const groups: Group[] = [];
  const put = (id: Id, x0: number, x1: number, y0: number, h: number) =>
    B.set(id, { x0, x1, y0, y1: y0 + h, cx: (x0 + x1) / 2, cy: y0 + h / 2 });
  const hOf = (id: Id, width: number) => boxHeight(boxLines(byId.get(id)!, width, lang));
  const row = (ids: Array<[Id, number, number]>, y: number) => {
    const h = Math.max(...ids.map(([id, x0, x1]) => hOf(id, x1 - x0)));
    for (const [id, x0, x1] of ids) put(id, x0, x1, y, h);
    return h;
  };
  let y = 0;
  const cw = Math.min(w - 2 * M, colW * 2.2);
  y += row([["clients", half - cw / 2, half + cw / 2]], y) + GAP;
  y += row([["runtime", M, w - M]], y) + GAP;
  // Three groups, each with two stacked boxes.
  const cols = [col(0), col(1), col(2)];
  const gTop = y;
  const top: Array<[Id, Id, Layer]> = [["retriever", "store", "retrieval"], ["mcpgw", "toolsrv", "tools"], ["sandbox", "egress", "sandbox"]];
  const yC = gTop + CAP;
  const hC = row(top.map(([a], i) => [a, cols[i][0] + INSET, cols[i][1] - INSET]), yC);
  const yD = yC + hC + INNER;
  const hD = row(top.map(([, b], i) => [b, cols[i][0] + INSET, cols[i][1] - INSET]), yD);
  const gBot = yD + hD + INSET;
  top.forEach(([, , layer], i) => groups.push({ layer, x0: cols[i][0], x1: cols[i][1], y0: gTop, y1: gBot }));
  y = gBot + GAP;
  y += row([["gateway", M, w - M]], y) + GAP;
  // Providers: hosted on the left half, self-hosted serving on the right.
  const pTop = y;
  const hP = row([["hosted", M + INSET, half - HG], ["serving", half + HG, w - M - INSET]], pTop + CAP);
  const pBot = pTop + CAP + hP + INSET;
  groups.push({ layer: "providers", x0: M, x1: w - M, y0: pTop, y1: pBot });
  y = pBot + GAP;
  const sv = B.get("serving")!;
  y += row([["compute", sv.x0, sv.x1]], y) + GAP;
  // Observability and evaluation: evals in the center column, so the judge's
  // call rises through the gap between the provider boxes.
  const oTop = y;
  const hO = row([["traces", M + INSET, cols[0][1]], ["evals", cols[1][0], cols[1][1]], ["dataset", cols[2][0], w - M - INSET]], oTop + CAP);
  const oBot = oTop + CAP + hO + INSET;
  groups.push({ layer: "observe", x0: M, x1: w - M, y0: oTop, y1: oBot });
  const gutL = (cols[0][1] + cols[1][0]) / 2, gutR = (cols[1][1] + cols[2][0]) / 2;
  return { B, groups, height: oBot, gutL, gutR, bus: M / 2 - 1 };
}

function desktopRoute(h: Hop, lay: ReturnType<typeof desktop>, w: number): Pt[] {
  const { B, gutL, gutR } = lay;
  const a = B.get(h.from)!;
  if (h.to === "out") return [[a.x1, a.cy], [w - 1, a.cy]];
  const b = B.get(h.to)!;
  const key = `${h.from}>${h.to}`;
  switch (key) {
    case "runtime>gateway": return [[gutL + 4, a.y1], [gutL + 4, b.y0]];
    case "retriever>gateway": return [[a.x1, a.cy], [gutL - 4, a.cy], [gutL - 4, b.y0]];
    case "sandbox>gateway": return [[a.x0, a.cy], [gutR, a.cy], [gutR, b.y0]];
    case "evals>gateway": return [[a.cx, a.y0], [a.cx, b.y1]];
    case "traces>evals": case "evals>dataset": return [[a.x1, a.cy], [b.x0, a.cy]];
  }
  // Straight down from the source into the target, at the target's center.
  return [[b.cx, a.y1], [b.cx, b.y0]];
}

// ---------------------------------------------------------------- phone layout

// One column, top to bottom in the same layer order. A long call across the
// column would be a thin line crossing every card, so each box lists its
// outgoing calls under its examples, with the credential's swatch.
const LAYER_ORDER: readonly Layer[] = ["clients", "runtime", "retrieval", "tools", "sandbox", "gateway", "providers", "compute", "observe"];
const HOP_SIZE = TYPE.small, HOP_LH = HOP_SIZE + 5, SW = 16;

function phoneHops(c: Comp, x0: number, width: number, lang: Lang) {
  const L = labels[lang];
  const rows: Array<{ lines: string[]; color: string; dashed: boolean }> = [];
  for (const h of HOPS.filter((h) => h.from === c.id)) {
    rows.push({ lines: wrapLines(tpl(L.phoneOut, { to: lead(nameOf(h.to, lang), lang), cred: CREDS[h.cred][lang] }), HOP_SIZE, width - 2 * PAD - SW - 6), color: CRED_COLOR[h.cred], dashed: false });
  }
  if (c.spans) rows.push({ lines: [L.phoneSpans], color: C.ink2, dashed: true });
  const n = rows.reduce((s, r) => s + r.lines.length, 0);
  const draw = (yStart: number): string[] => {
    const out: string[] = [];
    let yy = yStart;
    for (const r of rows) {
      out.push(el("line", { x1: x0 + PAD, x2: x0 + PAD + SW, y1: yy - 4, y2: yy - 4, stroke: r.color, "stroke-width": 2.4, "stroke-dasharray": r.dashed ? "4 3" : undefined }));
      for (const ln of r.lines) { out.push(text(x0 + PAD + SW + 6, yy, ln, { "font-size": HOP_SIZE })); yy += HOP_LH; }
    }
    return out;
  };
  return { height: n ? n * HOP_LH + 4 : 0, draw };
}

function phone(w: number, lang: Lang, sel: Sel, dimBox: (id: Id) => boolean): { svg: string; h: number } {
  const parts: string[] = [];
  let y = 0;
  for (const layer of LAYER_ORDER) {
    const comps = COMPS.filter((c) => c.layer === layer);
    const grouped = comps.length > 1;
    const x0 = grouped ? INSET : 0, x1 = grouped ? w - INSET : w;
    const top = y;
    let yy = y + (grouped ? CAP : 0);
    const inner: string[] = [];
    comps.forEach((c, i) => {
      const ls = boxLines(c, x1 - x0, lang);
      const hops = phoneHops(c, x0, x1 - x0, lang);
      const base = boxHeight(ls);
      const h = base + hops.height;
      const b: Box = { x0, x1, y0: yy, y1: yy + h, cx: (x0 + x1) / 2, cy: yy + h / 2 };
      inner.push(drawBox(c, b, lang, { sel, dim: dimBox(c.id) }, hops.draw(yy + base + HOP_SIZE - 2)));
      yy += h + (i < comps.length - 1 ? 8 : 0);
    });
    if (grouped) {
      yy += INSET;
      parts.push(el("rect", { x: 0, y: top, width: w, height: yy - top, rx: 8, fill: C.panel }));
      parts.push(text(INSET, top + 14, LAYERS[layer][lang], { "font-size": TYPE.small, class: "fig-t-muted" }));
    }
    parts.push(...inner);
    y = yy + 10;
  }
  return { svg: g({ class: "fig-stack" }, ...parts), h: y - 10 };
}

// ---------------------------------------------------------------- legend and readout

function drawLegend(y0: number, w: number, lang: Lang, narrow: boolean): { svg: string; h: number } {
  const L = labels[lang];
  const fs = TYPE.small;
  const parts: string[] = [text(0, y0 + fs, narrow ? L.legendPhone : L.legend, { "font-size": fs, class: "fig-t-muted" })];
  let y = y0 + fs + 16, x = 0;
  const items: Array<[string, string, boolean]> = [...CRED_ORDER.map((k) => [CREDS[k][lang], CRED_COLOR[k], false] as [string, string, boolean]), [L.telemetry, C.ink2, true]];
  for (const [label, color, dashed] of items) {
    const iw = SW + 6 + textWidth(label, fs);
    if (x > 0 && x + iw > w) { x = 0; y += fs + 8; }
    parts.push(el("line", { x1: x, x2: x + SW, y1: y - 4, y2: y - 4, stroke: color, "stroke-width": 2.4, "stroke-dasharray": dashed ? "4 3" : undefined }));
    parts.push(text(x + SW + 6, y, label, { "font-size": fs }));
    x += iw + 16;
  }
  return { svg: g({ class: "fig-legend" }, ...parts), h: y - y0 + 6 };
}

function drawReadout(sel: Sel, y0: number, w: number, lang: Lang, narrow: boolean): { svg: string; h: number } {
  const L = labels[lang];
  const parts: string[] = [];
  const fs = TYPE.body, lh = fs + 6;
  let y = y0;
  const para = (s: string, cls?: string, indent = 0) => {
    for (const ln of wrapLines(s, fs, w - indent)) { parts.push(text(indent, y + fs, ln, { "font-size": fs, class: cls })); y += lh; }
  };
  const swatchPara = (s: string, color: string, dashed: boolean) => {
    parts.push(el("line", { x1: 0, x2: SW, y1: y + fs - 4, y2: y + fs - 4, stroke: color, "stroke-width": 2.4, "stroke-dasharray": dashed ? "4 3" : undefined }));
    para(s, undefined, SW + 8);
    y += 2;
  };
  parts.push(el("line", { x1: 0, x2: w, y1: y, y2: y, stroke: C.grid }));
  y += 10;
  if (sel === "all") {
    if (!narrow) {
      parts.push(text(0, y + TYPE.label, L.all, { "font-size": TYPE.label, class: "fig-t-strong" }));
      y += TYPE.label + 10;
      for (const k of CRED_ORDER) {
        const hs = HOPS.filter((h) => h.cred === k);
        const list = hs.map((h) => tpl(L.hopShort, { from: tail(nameOf(h.from, lang), lang), to: lead(nameOf(h.to, lang), lang) })).join(L.listSep);
        swatchPara(tpl(L.credLine, { cred: CREDS[k][lang], list }), CRED_COLOR[k], false);
      }
      const emitters = COMPS.filter((c) => c.spans).map((c) => c.name[lang]).join(lang === "zh" ? "、" : ", ");
      swatchPara(tpl(L.credLine, { cred: L.telemetry, list: tpl(L.hopShort, { from: tail(emitters, lang), to: lead(nameOf("traces", lang), lang) }) }), C.ink2, true);
      y += 4;
    }
    para(L.hint, "fig-t-muted");
    return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
  }
  const c = byId.get(sel)!;
  parts.push(text(0, y + TYPE.label, c.name[lang], { "font-size": TYPE.label, class: "fig-t-strong" }));
  if (LAYERS[c.layer][lang] !== c.name[lang]) {
    const tw = textWidth(c.name[lang], TYPE.label);
    parts.push(text(tw + 10, y + TYPE.label, LAYERS[c.layer][lang], { "font-size": TYPE.small, class: "fig-t-muted" }));
  }
  y += TYPE.label + 10;
  para(c.does[lang]);
  y += 4;
  parts.push(text(0, y + TYPE.small, L.examplesHead, { "font-size": TYPE.small, class: "fig-t-muted" }));
  y += TYPE.small + 8;
  para(c.more[lang]);
  y += 4;
  para(tpl(L.governed, { c: contractText(c, lang) }));
  y += 6;
  const out = HOPS.filter((h) => h.from === c.id), inn = HOPS.filter((h) => h.to === c.id);
  for (const [head, hs, tmpl] of [[L.callsOut, out, L.hopOut], [L.callsIn, inn, L.hopIn]] as const) {
    if (!hs.length) continue;
    parts.push(text(0, y + TYPE.small, head, { "font-size": TYPE.small, class: "fig-t-muted" }));
    y += TYPE.small + 8;
    for (const h of hs) {
      swatchPara(tpl(tmpl, { to: lead(nameOf(h.to, lang), lang), from: lead(nameOf(h.from, lang), lang), call: h.call[lang], cred: CREDS[h.cred][lang], detail: h.detail[lang] }), CRED_COLOR[h.cred], false);
    }
    y += 4;
  }
  if (c.spans) swatchPara(L.spans, C.ink2, true);
  return { svg: g({ class: "fig-readout" }, ...parts), h: y - y0 };
}

// ---------------------------------------------------------------- render

function render(st: State<P>, lang: Lang): string {
  const L = labels[lang];
  const w = st.w;
  const sel = st.p.component;
  const narrow = w < 480;
  const related = new Set<Id>();
  if (sel !== "all") {
    related.add(sel);
    for (const h of HOPS) if (touches(h, sel)) { related.add(h.from); if (h.to !== "out") related.add(h.to); }
  }
  const dimBox = (id: Id) => sel !== "all" && !related.has(id);
  const parts: string[] = [];
  let y: number;
  if (narrow) {
    const ph = phone(w, lang, sel, dimBox);
    parts.push(ph.svg);
    y = ph.h + 16;
  } else {
    const lay = desktop(w, lang);
    for (const gr of lay.groups) {
      parts.push(el("rect", { x: gr.x0, y: gr.y0, width: gr.x1 - gr.x0, height: gr.y1 - gr.y0, rx: 8, fill: C.panel }));
      parts.push(text(gr.x0 + INSET, gr.y0 + 14, LAYERS[gr.layer][lang], { "font-size": TYPE.small, class: "fig-t-muted" }));
    }
    // Telemetry bus down the left margin into the trace store.
    const busOn = sel === "all" || sel === "traces" || byId.get(sel)?.spans === true;
    const busDim = !busOn;
    const tr = lay.B.get("traces")!;
    const stubs = COMPS.filter((c) => c.spans && lay.B.get(c.id)!.x0 <= M + INSET + 0.5).map((c) => lay.B.get(c.id)!);
    const topY = Math.min(...stubs.map((b) => b.cy));
    const busParts: string[] = [el("path", { d: pathOf([[lay.bus, topY], [lay.bus, tr.cy]]), fill: "none", stroke: C.ink2, "stroke-width": 1.6, "stroke-dasharray": "4 3" })];
    for (const b of stubs) busParts.push(el("path", { d: pathOf([[b.x0, b.cy], [lay.bus, b.cy]]), fill: "none", stroke: C.ink2, "stroke-width": 1.6, "stroke-dasharray": "4 3" }));
    busParts.push(edge([[lay.bus, tr.cy], [tr.x0, tr.cy]], C.ink2, false, false, true));
    parts.push(g({ opacity: busDim ? 0.22 : undefined, class: "fig-bus" }, ...busParts));
    // Calls, the selected component's drawn last.
    const order = [...HOPS].sort((a, b) => Number(sel !== "all" && touches(a, sel)) - Number(sel !== "all" && touches(b, sel)));
    for (const h of order) {
      const on = sel !== "all" && touches(h, sel);
      parts.push(edge(desktopRoute(h, lay, w), CRED_COLOR[h.cred], on, sel !== "all" && !on));
    }
    for (const c of COMPS) parts.push(drawBox(c, lay.B.get(c.id)!, lang, { sel, dim: dimBox(c.id) }));
    parts.push(text(tr.x0, lay.height + 16, L.spansFrom, { "font-size": TYPE.small, class: "fig-t-muted" }));
    y = lay.height + 34;
  }
  const lg = drawLegend(y, w, lang, narrow);
  parts.push(lg.svg);
  y += lg.h + 12;
  const ro = drawReadout(sel, y, w, lang, narrow);
  parts.push(ro.svg);
  y += ro.h + 4;
  return svg(w, y, describe(st, lang), ...parts);
}

export default defineFigure({
  name: "reference-stack",
  title: { en: labels.en.title, zh: labels.zh.title },
  labels,
  params: {
    component: {
      kind: "choice", control: "select", label: { en: "Component", zh: "组件" }, default: "all",
      options: [
        { value: "all", label: { en: "whole stack: credentials by call", zh: "整套技术栈：按调用看凭据" } },
        ...COMPS.map((c) => ({ value: c.id, label: { en: c.name.en, zh: c.name.zh } })),
      ],
    },
  },
  render,
  describe,
});
