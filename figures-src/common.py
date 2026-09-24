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

SVG_TEXT_PARAMS = {
    "svg.fonttype": "none",
}

ZH_SVG_PARAMS = {
    **SVG_TEXT_PARAMS,
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
    "materialized scores (B×H×L²)": "物化分数矩阵 (B×H×L²)",
    "one token-state tensor (B×L×d)": "单个词元状态张量 (B×L×d)",
    "context length L (tokens)": "上下文长度 L（词元）",
    "tensor size": "张量大小",
    "Attention relationships (quadratic)": "注意力关系（二次增长）",
    "Documents in corpus (n)": "语料文档数 (n)",
    "Held-out loss": "留出损失",
    "Parameters evaluated per token": "每词元实际计算的参数",
    "Pairwise comparisons": "两两比较次数",
    "Unfiltered stream (lower useful-token yield)": "未过滤数据流（有效词元率较低）",
    "Curated stream (higher useful-token yield)": "策展数据流（有效词元率较高）",
    "Context length (thousands of tokens)": "上下文长度（千词元）",
    "Growth relative to 1K tokens": "相对 1K 词元的增长倍数",
    "Recurrent updates (linear)": "递归更新（线性增长）",
    "Routed experts E (k = 2 selected)": "路由专家数 E（选中 k = 2）",
    "Stored parameters": "存储的参数",
    "Tokens consumed (log scale)": "消耗词元数（对数刻度）",
    "absorb": "被吸收",
    "active latents per token (L0 sparsity)": "每词元活跃潜变量（L0 稀疏度）",
    "agents": "智能体",
    "accept": "接受",
    "artifact": "产物",
    "autoregressive": "自回归",
    "batch size (units of noise scale, log scale)": "批大小（噪声尺度单位，对数刻度）",
    "back toward": "回到",
    "benchmark score (%)": "基准分数（%）",
    "ceiling": "天花板",
    "chain": "链式推理",
    "retained state": "保留的状态",
    "pruned state": "剪掉的状态",
    "accepted terminal": "通过检查的终止状态",
    "rejected terminal": "未通过检查的终止状态",
    "evaluator score": "评估器分数",
    "task check": "任务检查",
    "noise-scale knee": "噪声尺度拐点",
    "dependent steps": "依赖步骤数",
    "features split,": "特征分裂，",
    "filtered loop": "过滤后的循环",
    "graph reuse": "图复用",
    "harder successor": "更难的后继基准",
    "headroom is noise:": "剩余空间已被噪声淹没：",
    "held-out quality": "留出质量",
    "iterative NAR": "迭代式 NAR",
    "larger dictionary m": "更大的字典 m",
    "near-linear regime": "近线性区间",
    "measurement maturity": "测量成熟度",
    "original benchmark": "原始基准",
    "output length (tokens)": "输出长度（词元）",
    "policy": "政策",
    "polysemanticity": "多义性",
    "reconstruction error (normalized)": "重构误差（归一化）",
    "repair": "修复",
    "request": "请求",
    "result": "结果",
    "executor": "执行器",
    "diminishing returns": "收益递减",
    "self-training round": "自训练轮次",
    "serving": "服务",
    "scaling": "扩展律",
    "successive model generations": "连续模型代际",
    "system coupling": "系统耦合",
    "systems no longer separable": "系统已难以区分",
    "too dense:": "过密：",
    "too sparse:": "过疏：",
    "translator": "翻译器",
    "progress per optimizer step (normalized)": "每个优化器步骤的进展（归一化）",
    "step savings scale well": "步骤节省近似成比例",
    "fewer steps, lower efficiency": "步骤更少，效率更低",
    "tree search": "树搜索",
    "unfiltered loop": "未过滤循环",
    "value-guided": "价值引导",
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


def _clean_svg(svg):
    return "\n".join(line.rstrip() for line in svg.splitlines()) + "\n"


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
    buffer = io.StringIO()
    with matplotlib.rc_context(SVG_TEXT_PARAMS):
        fig.savefig(buffer, format="svg", bbox_inches="tight", transparent=True)
    en.write_text(_clean_svg(buffer.getvalue()), encoding="utf-8")
    with matplotlib.rc_context(ZH_SVG_PARAMS):
        _localize_figure_text(fig)
        fig.tight_layout()
        buffer = io.StringIO()
        fig.savefig(buffer, format="svg", bbox_inches="tight", transparent=True)
    zh.write_text(_clean_svg(_localize_svg(buffer.getvalue())), encoding="utf-8")


def finish(fig, ax, name, *, legend=None, grid=False):
    style_axes(ax, grid=grid)
    style_legend(legend)
    fig.tight_layout()
    save_bilingual(fig, name)
    plt.close(fig)


def new_fig(width=5.0, height=3.0):
    return plt.subplots(figsize=(width, height))
