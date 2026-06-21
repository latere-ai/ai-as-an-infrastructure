from pathlib import Path
import html
import io
from functools import partial
import re
import sys

import matplotlib

if "matplotlib.pyplot" not in sys.modules:
    matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib.text import Text
from matplotlib.ticker import FixedFormatter, FuncFormatter

ZH_SVG_PARAMS = {
    "svg.fonttype": "none",
    "font.family": "sans-serif",
    "font.sans-serif": [
        "PingFang SC",
        "Heiti SC",
        "STHeiti",
        "Noto Sans CJK SC",
        "Microsoft YaHei",
        "SimHei",
        "Arial Unicode MS",
        "DejaVu Sans",
    ],
    "axes.unicode_minus": False,
}

ROOT = Path(__file__).resolve().parents[1]

INK = "#6b7280"
DATA = "#3b82f6"
ACCENT = "#14b8a6"
WARN = "#f59e0b"
MUTED = "#9ca3af"

ZH_TEXT = {
    "95% confidence half-width (pp)": "95% 置信半宽（百分点）",
    "400-point gap,": "400 分差距，",
    "4 stages": "4 个阶段",
    "8 stages": "8 个阶段",
    "16 stages": "16 个阶段",
    "AI load demand": "AI 负载需求",
    "API": "API",
    "Active parameters (per-token FLOPs)": "活跃参数（每词元 FLOPs）",
    "All-pairs  $O(n^2)$": "全量两两比较  $O(n^2)$",
    "All-pairs $O(n^2)$": "全量两两比较 $O(n^2)$",
    "All-pairs O(n^2)": "全量两两比较 O(n²)",
    "Attention (quadratic)": "注意力（二次增长）",
    "Deduplicated + filtered": "去重 + 过滤",
    "DPO keeps": "DPO 继续",
    "DPO log-ratio reward (grows with length)": "DPO 对数比奖励（随长度增长）",
    "DPO log-sigmoid (unbounded pull)": "DPO 对数 S 形损失（无界拉开）",
    "Documents in corpus (n)": "语料文档数 (n)",
    "FP16": "FP16",
    "FLOPs": "FLOPs",
    "GQA": "GQA",
    "HBM": "HBM",
    "Held-out loss": "留出损失",
    "IO-aware kernel  O(L)": "IO 感知内核  O(L)",
    "INT4": "INT4",
    "INT8": "INT8",
    "IPO optimum": "IPO 最优点",
    "IPO squared loss (target at $\\tau$)": "IPO 平方损失（目标为 $\\tau$）",
    "IPO squared loss (target at τ)": "IPO 平方损失（目标为 τ）",
    "KL drift from SFT reference": "相对 SFT 参考的 KL 漂移",
    "KL from reference (optimization pressure)": "相对参考模型的 KL（优化压力）",
    "KV cache memory (GB)": "KV 缓存内存（GB）",
    "KV memory utilization": "KV 内存利用率",
    "MHA": "MHA",
    "MLA": "MLA",
    "MQA": "MQA",
    "MinHash + LSH  $\\approx O(n)$": "MinHash + LSH  $\\approx O(n)$",
    "MinHash + LSH $\\approx O(n)$": "MinHash + LSH $\\approx O(n)$",
    "MinHash + LSH ≈ O(n)": "MinHash + LSH ≈ O(n)",
    "NVLink boundary": "NVLink 边界",
    "NVLink tier": "NVLink 层",
    "Number of experts N (k = 2 active)": "专家数 N（k = 2 个激活）",
    "P(model i beats model j)": "模型 i 战胜模型 j 的概率",
    "P(y_w preferred over y_l)": "y_w 优于 y_l 的概率",
    "Pairwise comparisons": "两两比较次数",
    "Parameters": "参数量",
    "Raw web (duplicated, noisy)": "原始网页（重复且嘈杂）",
    "RL-trained model": "RL 训练模型",
    "Sequence length": "序列长度",
    "Sequence-mixing cost": "序列混合成本",
    "SimPO length-normalized reward (flat)": "SimPO 长度归一化奖励（平坦）",
    "State-space (linear)": "状态空间（线性增长）",
    "TD error": "TD 误差",
    "TPOT": "TPOT",
    "TPOT SLO": "TPOT SLO",
    "Tokens consumed (log scale)": "消耗词元数（对数刻度）",
    "Total parameters (capacity)": "总参数量（容量）",
    "accepted alpha = 0.8": "接受率 alpha = 0.8",
    "acceptance alpha = 0.8": "接受率 alpha = 0.8",
    "acceptance rate alpha": "接受率 alpha",
    "about 0.91": "约 0.91",
    "absorb": "被吸收",
    "accelerator generation": "加速器代际",
    "accuracy with a verifier": "带验证器的准确率",
    "accuracy with majority / reward model": "多数投票 / 奖励模型准确率",
    "action horizon": "行动跨度",
    "activation channel": "激活通道",
    "active latents per token (L0 sparsity)": "每词元活跃潜变量（L0 稀疏度）",
    "adapt": "适配",
    "adaptive crop": "自适应裁剪",
    "adapter": "适配器",
    "adversarial (rho=0 product)": "对抗性（rho=0 乘积）",
    "agent": "智能体",
    "agent count": "智能体数量",
    "agents": "智能体",
    "aggregate metric (e.g. perplexity)": "聚合指标（如困惑度）",
    "all healthy": "全部健康",
    "almost for free": "几乎免费",
    "ambient authority": "环境权限",
    "Arabic": "阿拉伯语",
    "and thus higher batch size": "因而支持更大批量",
    "answer length (relative to fixed-quality baseline)": "答案长度（相对固定质量基线）",
    "answerable evidence retained": "可回答证据保留量",
    "assisted oversight": "辅助监督",
    "attack strength": "攻击强度",
    "attack success rate": "攻击成功率",
    "at large k": "在大 k 处",
    "at long context": "长上下文处",
    "autoregressive": "自回归",
    "autonomous": "自主运行",
    "autonomy": "自主性",
    "batch": "批处理",
    "batch size": "批大小",
    "batch size (units of critical batch size, log scale)": "批大小（临界批大小单位，对数刻度）",
    "baseline": "基线",
    "baseline: one token per pass": "基线：每次通过一个词元",
    "base model": "基座模型",
    "base overtakes": "基座模型反超",
    "back toward": "回到",
    "benchmark score (%)": "基准分数（%）",
    "begins": "开始",
    "below here the gap": "低于此处时差距",
    "big bang deploy": "一次性部署",
    "blast radius": "影响半径",
    "block size (tokens per block)": "块大小（每块词元数）",
    "block size that": "使总成本最低的",
    "browser only": "仅浏览器",
    "bulk crushed onto a few levels": "主体被压到少数几个量级",
    "Burmese": "缅甸语",
    "cache overtakes weights": "缓存超过权重",
    "cached tokens per request (context length)": "每请求缓存词元数（上下文长度）",
    "candidate mass retained": "候选质量保留量",
    "candidates per prompt, n (log scale)": "每提示候选数 n（对数刻度）",
    "canary ramp": "金丝雀放量",
    "capability": "能力",
    "capability coverage": "能力覆盖",
    "capability scoped": "能力范围化",
    "capacity grows": "容量增长",
    "cat": "猫",
    "ceiling": "天花板",
    "chain": "链式推理",
    "chat": "聊天",
    "cheap frontier": "廉价前沿",
    "cheap small runs (fit)": "廉价小规模运行（拟合）",
    "affordable": "可承受",
    "checkpoint interval (minutes)": "检查点间隔（分钟）",
    "checkpoint overhead": "检查点开销",
    "cite": "引用",
    "chunk": "分块",
    "closed frontier": "闭源前沿",
    "coin flip": "硬币正反面",
    "completion rate": "完成率",
    "components in fleet": "集群组件数",
    "compose": "合成",
    "compute-to-communication ratio per step": "每步计算/通信比",
    "compute well spent": "算力投入有效",
    "compute wasted": "算力被浪费",
    "compression": "压缩",
    "constraint intensity": "约束强度",
    "constraint pressure": "约束压力",
    "containment": "隔离程度",
    "container": "容器",
    "context budget": "上下文预算",
    "context length (thousands of tokens)": "上下文长度（千词元）",
    "coordination cost": "协调成本",
    "cost per training hour": "每训练小时成本",
    "cost-adjusted speedup": "成本校正后的加速比",
    "coverage (any sample correct)": "覆盖率（任一样本正确）",
    "critical batch size": "临界批大小",
    "cross-modal task quality": "跨模态任务质量",
    "curated stream": "整理后的流",
    "data": "数据",
    "data lifecycle stage": "数据生命周期阶段",
    "decode batch size (concurrent requests)": "解码批大小（并发请求）",
    "decode latency (relative)": "解码延迟（相对值）",
    "delegation depth": "委托深度",
    "deployment speed": "部署速度",
    "dependent steps": "依赖步骤数",
    "diffusion": "扩散",
    "diffusion denoise": "扩散去噪",
    "direct": "直接回答",
    "distilled": "蒸馏后",
    "draft cost ratio c = 0.02": "草稿成本比 c = 0.02",
    "draft cost ratio c = 0.05": "草稿成本比 c = 0.05",
    "draft cost ratio c = 0.1": "草稿成本比 c = 0.1",
    "draft length gamma (tokens proposed per pass)": "草稿长度 gamma（每次提出的词元数）",
    "draft length gamma = 2": "草稿长度 gamma = 2",
    "draft length gamma = 4": "草稿长度 gamma = 4",
    "draft length gamma = 8": "草稿长度 gamma = 8",
    "dry run": "空跑",
    "efficiency": "效率",
    "embed": "嵌入",
    "embedding + output parameters": "嵌入与输出参数",
    "embedding dimension 1": "嵌入维度 1",
    "embedding dimension 2": "嵌入维度 2",
    "emergence": "涌现",
    "end-to-end success": "端到端成功率",
    "environment RL": "环境强化学习",
    "English": "英语",
    "ephemeral VM": "临时虚拟机",
    "equal ratings,": "评分相同，",
    "error rate": "错误率",
    "eval": "评测",
    "expected quality of selected answer": "所选答案的期望质量",
    "expected tokens per target pass": "每次目标模型通过的期望词元数",
    "export": "出口管制",
    "extrapolate": "外推",
    "fair judge (quality fixed)": "公正评判者（质量固定）",
    "false negatives": "假阴性",
    "false positives": "假阳性",
    "features split,": "特征分裂，",
    "field-map-1": "field-map-1",
    "filtered loop": "过滤后的循环",
    "fine-tune": "微调",
    "fixed patches": "固定图块",
    "flow path": "流路径",
    "forecast large run": "预测大规模运行",
    "formal tool": "形式工具",
    "from scratch": "从头训练",
    "fraction of collective hidden under compute": "被计算隐藏的集合通信比例",
    "fraction of prompts solved": "被解出的提示比例",
    "freshness": "鲜度",
    "frontier": "前沿",
    "full SFT": "完整 SFT",
    "full duplex": "全双工",
    "generation time": "生成时间",
    "German": "德语",
    "gateway": "网关",
    "governance": "治理",
    "governance latency": "治理延迟",
    "guardrail strictness": "护栏严格度",
    "hard negative": "困难负样本",
    "hardened": "加固后",
    "harder successor": "更难的后继基准",
    "headroom is noise:": "剩余空间已被噪声淹没：",
    "held-out quality": "留出质量",
    "held-out set size (examples, log scale)": "留出集规模（样本数，对数刻度）",
    "high-quality stock": "高质量存量",
    "Hindi": "印地语",
    "human review": "人工审查",
    "image edge (pixels)": "图像边长（像素）",
    "imitation": "模仿",
    "imperfect verifier": "不完美验证器",
    "implicit reward (idealized units)": "隐式奖励（理想化单位）",
    "implicit reward gap (chosen minus rejected)": "隐式奖励差（选中减被拒）",
    "index": "索引",
    "indirection overhead (table + gather)": "间接开销（块表 + gather）",
    "inference-time": "推理时",
    "instrumentation depth": "观测埋点深度",
    "integration risk": "集成风险",
    "inter-node network": "节点间网络",
    "internal fragmentation (partial block)": "内部碎片（不满块）",
    "invoice": "发票",
    "is swamped by noise": "会被噪声淹没",
    "isolation strength": "隔离强度",
    "issue detection": "问题发现能力",
    "iterative NAR": "迭代式 NAR",
    "job survival probability": "作业存活概率",
    "judge win rate for the longer answer": "评判者选择长答案的胜率",
    "k, samples per problem (log scale)": "每题样本数 k（对数刻度）",
    "kitten": "小猫",
    "knee": "拐点",
    "latency": "延迟",
    "latency budget": "延迟预算",
    "larger dictionary m": "更大的字典 m",
    "largest batch within SLO": "SLO 内最大批量",
    "lead time": "交付周期",
    "leftover KV pool (total minus weights)": "剩余 KV 池（总内存减权重）",
    "linear regime": "线性区间",
    "live telemetry": "线上遥测",
    "local small": "本地小模型",
    "long tasks": "长任务",
    "lost work on failure": "故障丢失工作",
    "materialized scores  O(L²)": "物化分数矩阵  O(L²)",
    "max absolute value": "最大绝对值",
    "mean / max request length (length spread)": "平均 / 最大请求长度（长度分散度）",
    "measured pass rate": "测得通过率",
    "measurement maturity": "测量成熟度",
    "memory": "内存",
    "memory bandwidth": "内存带宽",
    "memory (relative units)": "内存（相对单位）",
    "memory budget": "记忆预算",
    "metaphor risk": "隐喻风险",
    "micro-batches per step (m)": "每步微批数 (m)",
    "model": "模型",
    "model FLOPs utilization (normalized)": "模型 FLOPs 利用率（归一化）",
    "model capability": "模型能力",
    "model generation": "模型代际",
    "model weights": "模型权重",
    "modular": "模块化",
    "minimizes total cost": "块大小",
    "noise level": "噪声水平",
    "normalized value": "归一化值",
    "offline evals": "离线评测",
    "one request's KV cache": "单个请求的 KV 缓存",
    "open weights": "开放权重",
    "operator control": "操作者控制",
    "optimal n, then": "最优 n 之后",
    "original benchmark": "原始基准",
    "output length (tokens)": "输出长度（词元）",
    "over-optimized": "过度优化",
    "over-optimization": "过度优化",
    "overkill": "过度配置",
    "oversight cost": "监督成本",
    "p = 0.95": "p = 0.95",
    "p = 0.99": "p = 0.99",
    "paged (block by block)": "分页分配（逐块）",
    "paired multimodal data (relative)": "配对多模态数据（相对值）",
    "packed context": "打包后的上下文",
    "parse": "解析",
    "pass@k": "pass@k",
    "peak attention memory (arbitrary units)": "注意力峰值内存（任意单位）",
    "per-example loss": "单样本损失",
    "per-tensor scale must reach the top outlier": "每张量 scale 必须覆盖最大离群值",
    "per-token latency / TPOT (normalized)": "每词元延迟 / TPOT（归一化）",
    "perfect verifier": "完美验证器",
    "pipeline bubble fraction": "流水线气泡比例",
    "plain attention": "朴素注意力",
    "planner": "规划器",
    "policy": "政策",
    "policy risk": "政策风险",
    "polysemanticity": "多义性",
    "pool holds 33 such requests": "内存池可容纳 33 个此类请求",
    "position in context (%)": "上下文位置（%）",
    "power delivered": "已交付电力",
    "privilege retained": "保留权限",
    "privileged host": "高权限主机",
    "prompt": "提示",
    "production-data-engine-1": "production-data-engine-1",
    "proxy reward": "代理奖励",
    "pure bias": "纯粹偏置",
    "pushing the gap": "拉开奖励差",
    "quality control": "质量控制",
    "quality loss": "质量损失",
    "quality retained vs FP baseline": "相对 FP 基线保留的质量",
    "quality turns down": "质量开始下降",
    "rating gap  r_i - r_j": "评分差  r_i - r_j",
    "raw dump": "原始堆放",
    "raw firehose": "原始数据洪流",
    "raw log": "原始日志",
    "reason": "推理",
    "receipt": "收据",
    "recognize": "识别",
    "reclaimed utilization,": "追回的利用率，",
    "reconstruction error (normalized)": "重构误差（归一化）",
    "reducible loss above floor (log scale)": "高于下限的可约损失（对数刻度）",
    "relative budget": "相对预算",
    "relative capacity": "相对容量",
    "relative growth": "相对增长",
    "relative pace": "相对节奏",
    "relative parameter count": "相对参数量",
    "relative sequence length": "相对序列长度",
    "relative strength": "相对强度",
    "relative token pressure": "相对词元压力",
    "relative units": "相对单位",
    "relative value": "相对值",
    "release phase": "发布阶段",
    "remote sandbox": "远程沙箱",
    "rerank": "重排",
    "reserve max length": "预留最大长度",
    "residual exposure": "残余暴露",
    "response length (tokens)": "回答长度（词元）",
    "retrieval": "检索",
    "retrieval accuracy": "检索准确率",
    "retrieve": "检索",
    "robot": "机器人",
    "Russian": "俄语",
    "runtime": "运行时",
    "runtime cost": "运行成本",
    "same difference, same P": "差值相同，概率也相同",
    "samples per prompt, k (log scale)": "每提示样本数 k（对数刻度）",
    "saturation": "饱和区",
    "score (arbitrary units)": "分数（任意单位）",
    "score difference  r(y_w) - r(y_l)": "分数差  r(y_w) - r(y_l)",
    "selector gap": "选择器差距",
    "self-host": "自托管",
    "self-training round": "自训练轮次",
    "sequence length": "序列长度",
    "sequence length L (arbitrary units)": "序列长度 L（任意单位）",
    "served tokens (relative)": "服务词元数（相对值）",
    "serve": "服务",
    "serving": "服务",
    "serving cost": "服务成本",
    "short tasks": "短任务",
    "scaling": "扩展律",
    "small": "小模型",
    "solve rate": "解题率",
    "speak": "说话",
    "specific capability": "特定能力",
    "specialized": "专用模型",
    "Spanish": "西班牙语",
    "spilled onto inter-node network": "溢出到节点间网络",
    "stack components": "技术栈组件",
    "stack responsibility": "技术栈责任",
    "stays finite": "保持有限",
    "stream": "流处理",
    "structured cache": "结构化缓存",
    "success rate": "成功率",
    "successive model generations": "连续模型代际",
    "summary": "摘要",
    "supervision density": "监督密度",
    "system coupling": "系统耦合",
    "systems no longer separable": "系统已难以区分",
    "task adaptation": "任务适配",
    "task examples": "任务样本数",
    "task eval": "任务评测",
    "task freedom": "任务自由度",
    "task horizon (steps)": "任务跨度（步数）",
    "task quality": "任务质量",
    "test-time samples": "测试时样本数",
    "tensor-parallel degree": "张量并行度",
    "text": "文本",
    "text chat": "文字聊天",
    "the DPO score": "DPO 分数",
    "throughput": "吞吐量",
    "throughput (normalized)": "吞吐量（归一化）",
    "tokens for the same sentence": "同一句话所需词元数",
    "too dense:": "过密：",
    "too sparse:": "过疏：",
    "tool use": "工具使用",
    "tools": "工具",
    "total cost": "总成本",
    "train": "训练",
    "trainable parameters": "可训练参数",
    "training compute (FLOPs, log scale)": "训练算力（FLOPs，对数刻度）",
    "training demand": "训练需求",
    "training progress per step (normalized)": "每步训练进展（归一化）",
    "training reward": "训练奖励",
    "tracked lineage": "带谱系追踪",
    "trajectory eval": "轨迹评测",
    "tree search": "树搜索",
    "true gap between two systems": "两个系统之间的真实差距",
    "true quality": "真实质量",
    "trust": "信任",
    "unit eval": "单元评测",
    "unfiltered loop": "未过滤循环",
    "unified": "统一式",
    "unmeasured cost": "未测出的代价",
    "useful recall": "有效召回",
    "useful work": "有效工作",
    "user-visible risk": "用户可见风险",
    "utilization": "利用率",
    "verify": "验证",
    "vision": "视觉",
    "vision tokens": "视觉词元数",
    "vocabulary size (tokens)": "词表规模（词元）",
    "voice turn": "语音回合",
    "wafer": "晶圆",
    "wasted fraction of KV memory": "KV 内存浪费比例",
    "weight bitwidth (bits)": "权重位宽（比特）",
    "where-learning-hits-limits-1": "where-learning-hits-limits-1",
    "widening gap": "差距拉大",
    "widening gap: the": "差距拉大：",
    "with recovery": "带恢复机制",
    "within NVLink domain": "NVLink 域内",
    "without lineage": "没有谱系追踪",
    "wordiness raises": "冗长会抬高",
    "world model": "世界模型",
    "year": "年份",
}


def style_axes(ax, *, grid=False):
    for spine in ("top", "right"):
        ax.spines[spine].set_visible(False)
    for spine in ("left", "bottom"):
        ax.spines[spine].set_color(INK)
    ax.tick_params(colors=INK, which="both")
    ax.xaxis.label.set_color(INK)
    ax.yaxis.label.set_color(INK)
    for label in ax.get_xticklabels() + ax.get_yticklabels():
        label.set_color(INK)
    if grid:
        ax.grid(True, color=INK, alpha=0.12, linewidth=0.8)


def style_legend(leg):
    if leg is None:
        return
    leg.set_frame_on(False)
    if leg.get_title():
        leg.get_title().set_color(INK)
    for text in leg.get_texts():
        text.set_color(INK)


TEXT_RE = re.compile(r">([^<>]+)<")
COMMENT_RE = re.compile(r"<!--\s*(.*?)\s*-->", re.S)


def _localize_svg(svg):
    def replace_text(match):
        text = html.unescape(match.group(1))
        localized = ZH_TEXT.get(text)
        if localized is None:
            return match.group(0)
        return f">{html.escape(localized, quote=False)}<"

    def replace_comment(match):
        text = " ".join(match.group(1).split())
        localized = ZH_TEXT.get(text)
        if localized is None:
            return match.group(0)
        return f"<!-- {localized} -->"

    return COMMENT_RE.sub(replace_comment, TEXT_RE.sub(replace_text, svg))


def _localize_figure_text(fig):
    for ax in fig.axes:
        for axis in (ax.xaxis, ax.yaxis):
            formatter = axis.get_major_formatter()
            if isinstance(formatter, FixedFormatter):
                formatter.seq = [ZH_TEXT.get(str(item), item) for item in formatter.seq]
            elif isinstance(formatter, FuncFormatter) and isinstance(formatter.func, partial):
                if formatter.func.args and isinstance(formatter.func.args[0], dict):
                    labels = formatter.func.args[0]
                    for key, value in list(labels.items()):
                        localized = ZH_TEXT.get(str(value))
                        if localized is not None:
                            labels[key] = localized

    for text in fig.findobj(match=Text):
        localized = ZH_TEXT.get(text.get_text())
        if localized is not None:
            text.set_text(localized)


def save_bilingual(fig, name):
    en = ROOT / "en" / "figures" / f"{name}.svg"
    zh = ROOT / "zh" / "figures" / f"{name}.svg"
    en.parent.mkdir(parents=True, exist_ok=True)
    zh.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(en, format="svg", bbox_inches="tight", transparent=True)
    with matplotlib.rc_context(ZH_SVG_PARAMS):
        _localize_figure_text(fig)
        fig.tight_layout()
        buffer = io.StringIO()
        fig.savefig(buffer, format="svg", bbox_inches="tight", transparent=True)
    zh.write_text(_localize_svg(buffer.getvalue()), encoding="utf-8")


def finish(fig, ax, name, *, legend=None, grid=False):
    style_axes(ax, grid=grid)
    style_legend(legend)
    fig.tight_layout()
    save_bilingual(fig, name)
    plt.close(fig)


def new_fig(width=5.0, height=3.0):
    return plt.subplots(figsize=(width, height))
