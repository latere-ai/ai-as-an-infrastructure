import sys

import numpy as np

from common import ACCENT, DATA, INK, MUTED, WARN, finish, new_fig


def _line(name, spec):
    fig, ax = new_fig(spec.get("width", 5.0), spec.get("height", 3.0))
    x = np.array(spec["x"], dtype=float)
    colors = spec.get("colors", [DATA, ACCENT, WARN, MUTED])
    for i, series in enumerate(spec["series"]):
        color = series.get("color", colors[i % len(colors)])
        ax.plot(
            x,
            np.array(series["y"], dtype=float),
            series.get("style", "-"),
            color=color,
            linewidth=series.get("lw", 1.9),
            marker=series.get("marker", ""),
            markersize=series.get("ms", 4),
            label=series["label"],
        )
    if spec.get("logx"):
        ax.set_xscale("log")
    if spec.get("logy"):
        ax.set_yscale("log")
    ax.set_xlabel(spec["xlabel"], color=INK)
    ax.set_ylabel(spec["ylabel"], color=INK)
    if "xlim" in spec:
        ax.set_xlim(*spec["xlim"])
    if "ylim" in spec:
        ax.set_ylim(*spec["ylim"])
    for ann in spec.get("annotations", []):
        ax.annotate(
            ann["text"],
            xy=ann["xy"],
            xytext=ann["xytext"],
            color=INK,
            fontsize=8,
            arrowprops=dict(arrowstyle="->", color=INK, lw=0.9),
        )
    leg = ax.legend(frameon=False, fontsize=8, loc=spec.get("legend", "best"))
    finish(fig, ax, name, legend=leg, grid=spec.get("grid", False))


def _bars(name, spec):
    fig, ax = new_fig(spec.get("width", 5.0), spec.get("height", 3.0))
    categories = spec["categories"]
    x = np.arange(len(categories))
    series = spec["series"]
    colors = spec.get("colors", [DATA, ACCENT, WARN, MUTED])
    width = min(0.72 / max(len(series), 1), 0.28)
    offset0 = -width * (len(series) - 1) / 2
    for i, item in enumerate(series):
        ax.bar(
            x + offset0 + i * width,
            item["values"],
            width=width,
            color=item.get("color", colors[i % len(colors)]),
            alpha=item.get("alpha", 0.92),
            label=item.get("label"),
        )
    ax.set_xticks(x)
    ax.set_xticklabels(categories, rotation=spec.get("rotation", 0), ha=spec.get("ha", "center"))
    ax.set_ylabel(spec["ylabel"], color=INK)
    if "ylim" in spec:
        ax.set_ylim(*spec["ylim"])
    leg = ax.legend(frameon=False, fontsize=8, loc=spec.get("legend", "best")) if any(s.get("label") for s in series) else None
    finish(fig, ax, name, legend=leg, grid=spec.get("grid", False))


def _stacked(name, spec):
    fig, ax = new_fig(spec.get("width", 5.0), spec.get("height", 3.0))
    categories = spec["categories"]
    x = np.arange(len(categories))
    bottom = np.zeros(len(categories))
    colors = spec.get("colors", [DATA, ACCENT, WARN, MUTED])
    for i, segment in enumerate(spec["segments"]):
        values = np.array(segment["values"], dtype=float)
        ax.bar(x, values, bottom=bottom, color=segment.get("color", colors[i % len(colors)]), label=segment["label"], width=0.58)
        bottom += values
    ax.set_xticks(x)
    ax.set_xticklabels(categories)
    ax.set_ylabel(spec["ylabel"], color=INK)
    if "ylim" in spec:
        ax.set_ylim(*spec["ylim"])
    leg = ax.legend(frameon=False, fontsize=8, loc=spec.get("legend", "upper left"))
    finish(fig, ax, name, legend=leg, grid=spec.get("grid", False))


def _scatter(name, spec):
    from matplotlib.backends.backend_agg import FigureCanvasAgg

    fig, ax = new_fig(spec.get("width", 5.0), spec.get("height", 3.0))
    ax.set_xlim(*spec.get("xlim", (0, 1)))
    ax.set_ylim(*spec.get("ylim", (0, 1)))
    gap = 0.025
    pending = []
    for point in spec["points"]:
        dy = point.get("dy", 0.02)
        ax.scatter(point["x"], point["y"], s=point.get("s", 42), color=point.get("color", DATA), zorder=3)
        if "dx" in point or "ha" in point:
            # Explicit manual placement (escape hatch for special cases).
            dx = point.get("dx", gap)
            ha = point.get("ha", "right" if dx < 0 else "left")
            ax.text(point["x"] + dx, point["y"] + dy, point["label"], color=INK, fontsize=8, ha=ha)
        else:
            # Default: top-right, left-aligned, so every label reads the same
            # way relative to its dot. Flip to the left only if it would spill
            # past the right edge (measured below), keeping it inside the plot.
            txt = ax.text(point["x"] + gap, point["y"] + dy, point["label"], color=INK, fontsize=8, ha="left")
            pending.append((txt, point["x"]))
    xmax = ax.get_xlim()[1]
    renderer = FigureCanvasAgg(fig).get_renderer()
    inv = ax.transData.inverted()
    for txt, px in pending:
        right_data = inv.transform((txt.get_window_extent(renderer).x1, 0.0))[0]
        if right_data > xmax:
            txt.set_x(px - gap)
            txt.set_ha("right")
    ax.set_xlabel(spec["xlabel"], color=INK)
    ax.set_ylabel(spec["ylabel"], color=INK)
    finish(fig, ax, name, grid=spec.get("grid", True))


def _funnel(name, spec):
    fig, ax = new_fig(spec.get("width", 5.0), spec.get("height", 3.0))
    stages = spec["stages"]
    values = np.array(spec["values"], dtype=float)
    y = np.arange(len(stages))
    colors = spec.get("colors", [DATA, ACCENT, WARN, MUTED])
    ax.barh(y, values, color=[colors[i % len(colors)] for i in range(len(stages))], alpha=0.9)
    ax.set_yticks(y)
    ax.set_yticklabels(stages)
    ax.invert_yaxis()
    ax.set_xlabel(spec["xlabel"], color=INK)
    ax.set_xlim(0, spec.get("xmax", max(values) * 1.1))
    finish(fig, ax, name, grid=spec.get("grid", False))



SPECS = {
    "whole-stack-1": {
        "type": "stacked",
        "categories": ["data", "train", "adapt", "serve", "agent"],
        "segments": [
            {"label": "capability", "values": [0.35, 0.75, 0.45, 0.25, 0.40], "color": DATA},
            {"label": "efficiency", "values": [0.20, 0.30, 0.25, 0.70, 0.45], "color": ACCENT},
            {"label": "trust", "values": [0.25, 0.15, 0.35, 0.40, 0.65], "color": WARN},
        ],
        "ylabel": "constraint pressure",
        "ylim": (0, 1.75),
    },
    "field-map-1": {
        "type": "scatter",
        "points": [
            {"label": "scaling", "x": 0.24, "y": 0.78, "color": DATA},
            {"label": "serving", "x": 0.52, "y": 0.62, "color": ACCENT},
            {"label": "agents", "x": 0.75, "y": 0.38, "color": WARN},
            {"label": "policy", "x": 0.86, "y": 0.22, "color": MUTED},
        ],
        "xlabel": "system coupling",
        "ylabel": "measurement maturity",
    },
    "borrowed-ideas-1": {
        "type": "bars",
        "categories": ["compression", "TD error", "diffusion", "emergence"],
        "series": [
            {"label": "formal tool", "values": [0.90, 0.72, 0.86, 0.38], "color": DATA},
            {"label": "metaphor risk", "values": [0.28, 0.36, 0.22, 0.70], "color": WARN},
        ],
        "ylabel": "relative strength",
        "ylim": (0, 1.05),
        "rotation": 12,
        "ha": "right",
    },
    "diffusion-flow-matching-1": {
        "type": "line",
        "x": [0, 1, 2, 3, 4, 5],
        "series": [
            {"label": "diffusion denoise", "y": [1.0, 0.72, 0.50, 0.31, 0.16, 0.05], "color": DATA},
            {"label": "flow path", "y": [1.0, 0.80, 0.60, 0.40, 0.20, 0.0], "color": ACCENT, "style": "--"},
        ],
        "xlabel": "generation time",
        "ylabel": "noise level",
        "ylim": (0, 1.05),
    },
    "nar-diffusion-lms-1": {
        "type": "line",
        "x": [8, 16, 32, 64, 128, 256],
        "series": [
            {"label": "autoregressive", "y": [0.10, 0.20, 0.38, 0.70, 1.25, 2.20], "color": DATA},
            {"label": "iterative NAR", "y": [0.18, 0.25, 0.34, 0.48, 0.70, 1.02], "color": ACCENT},
        ],
        "xlabel": "output length (tokens)",
        "ylabel": "decode latency (relative)",
        "logx": True,
        "ylim": (0, 2.35),
    },
    "speech-and-voice-1": {
        "type": "stacked",
        "categories": ["text chat", "voice turn", "full duplex"],
        "segments": [
            {"label": "recognize", "values": [0.00, 0.22, 0.15], "color": MUTED},
            {"label": "reason", "values": [0.62, 0.48, 0.32], "color": DATA},
            {"label": "speak", "values": [0.00, 0.24, 0.18], "color": ACCENT},
        ],
        "ylabel": "latency budget",
        "ylim": (0, 1.1),
    },
    "multimodal-models-1": {
        "type": "line",
        "x": [1, 2, 4, 8, 16, 32],
        "series": [
            {"label": "modular", "y": [0.34, 0.46, 0.57, 0.65, 0.70, 0.72], "color": DATA},
            {"label": "unified", "y": [0.20, 0.33, 0.50, 0.68, 0.82, 0.90], "color": ACCENT},
        ],
        "xlabel": "paired multimodal data (relative)",
        "ylabel": "cross-modal task quality",
        "logx": True,
        "ylim": (0.15, 0.95),
    },
    "beyond-text-1": {
        "type": "scatter",
        "points": [
            {"label": "text", "x": 0.20, "y": 0.84, "color": DATA},
            {"label": "vision", "x": 0.38, "y": 0.62, "color": ACCENT},
            {"label": "world model", "x": 0.64, "y": 0.42, "color": WARN},
            {"label": "robot", "x": 0.84, "y": 0.20, "color": MUTED},
        ],
        "xlabel": "action horizon",
        "ylabel": "supervision density",
    },
    "sft-peft-1": {
        "type": "scatter",
        "points": [
            {"label": "prompt", "x": 0.08, "y": 0.40, "color": MUTED},
            {"label": "LoRA", "x": 0.20, "y": 0.70, "color": DATA},
            {"label": "adapter", "x": 0.36, "y": 0.75, "color": ACCENT},
            {"label": "full SFT", "x": 0.86, "y": 0.88, "color": WARN},
        ],
        "xlabel": "trainable parameters",
        "ylabel": "task adaptation",
    },
    "synthetic-data-self-improvement-1": {
        "type": "line",
        "x": [0, 1, 2, 3, 4, 5, 6],
        "series": [
            {"label": "filtered loop", "y": [0.45, 0.55, 0.63, 0.69, 0.73, 0.75, 0.76], "color": DATA},
            {"label": "unfiltered loop", "y": [0.45, 0.50, 0.51, 0.49, 0.45, 0.40, 0.34], "color": WARN},
        ],
        "xlabel": "self-training round",
        "ylabel": "held-out quality",
        "ylim": (0.30, 0.80),
    },
    "eliciting-reasoning-1": {
        "type": "line",
        "x": [1, 2, 4, 8, 16, 32],
        "series": [
            {"label": "direct", "y": [0.42, 0.43, 0.44, 0.44, 0.44, 0.44], "color": MUTED},
            {"label": "chain", "y": [0.45, 0.51, 0.58, 0.64, 0.68, 0.69], "color": DATA},
            {"label": "tree search", "y": [0.40, 0.48, 0.60, 0.72, 0.80, 0.84], "color": ACCENT},
        ],
        "xlabel": "test-time samples",
        "ylabel": "solve rate",
        "logx": True,
        "ylim": (0.35, 0.90),
    },
    "structured-long-context-1": {
        "type": "line",
        "x": [0, 10, 25, 50, 75, 90, 100],
        "series": [
            {"label": "plain attention", "y": [0.82, 0.72, 0.52, 0.38, 0.54, 0.74, 0.84], "color": DATA},
            {"label": "structured cache", "y": [0.80, 0.77, 0.74, 0.72, 0.75, 0.78, 0.81], "color": ACCENT},
        ],
        "xlabel": "position in context (%)",
        "ylabel": "retrieval accuracy",
        "ylim": (0.30, 0.90),
    },
    "serving-multimodal-1": {
        "type": "line",
        "x": [224, 336, 448, 672, 896, 1344],
        "series": [
            {"label": "fixed patches", "y": [196, 441, 784, 1764, 3136, 7056], "color": DATA},
            {"label": "adaptive crop", "y": [196, 360, 560, 980, 1450, 2300], "color": ACCENT},
        ],
        "xlabel": "image edge (pixels)",
        "ylabel": "vision tokens",
        "ylim": (0, 7600),
    },
    "training-agents-to-act-1": {
        "type": "line",
        "x": [1, 2, 4, 8, 16, 32],
        "series": [
            {"label": "imitation", "y": [0.70, 0.66, 0.58, 0.46, 0.34, 0.23], "color": DATA},
            {"label": "environment RL", "y": [0.32, 0.42, 0.56, 0.67, 0.75, 0.80], "color": ACCENT},
        ],
        "xlabel": "task horizon (steps)",
        "ylabel": "success rate",
        "logx": True,
        "ylim": (0.15, 0.85),
    },
    "agent-architectures-1": {
        "type": "scatter",
        "points": [
            {"label": "chat", "x": 0.12, "y": 0.18, "color": MUTED},
            {"label": "tool use", "x": 0.36, "y": 0.38, "color": DATA},
            {"label": "planner", "x": 0.58, "y": 0.58, "color": ACCENT},
            {"label": "autonomous", "x": 0.82, "y": 0.82, "color": WARN},
        ],
        "xlabel": "autonomy",
        "ylabel": "blast radius",
    },
    "memory-systems-1": {
        "type": "line",
        "x": [1, 2, 4, 8, 16, 32, 64],
        "series": [
            {"label": "raw log", "y": [0.30, 0.40, 0.52, 0.62, 0.69, 0.73, 0.75], "color": DATA},
            {"label": "summary", "y": [0.36, 0.50, 0.62, 0.70, 0.74, 0.75, 0.73], "color": ACCENT},
            {"label": "retrieval", "y": [0.28, 0.44, 0.64, 0.78, 0.86, 0.90, 0.91], "color": WARN},
        ],
        "xlabel": "memory budget",
        "ylabel": "useful recall",
        "logx": True,
        "ylim": (0.20, 0.95),
    },
    "the-harness-1": {
        "type": "scatter",
        "points": [
            {"label": "dry run", "x": 0.18, "y": 0.25, "color": MUTED},
            {"label": "container", "x": 0.42, "y": 0.55, "color": DATA},
            {"label": "VM", "x": 0.66, "y": 0.74, "color": ACCENT},
            {"label": "remote sandbox", "x": 0.84, "y": 0.88, "color": WARN},
        ],
        "xlabel": "runtime cost",
        "ylabel": "isolation strength",
    },
    "multi-agent-systems-1": {
        "type": "line",
        "x": [1, 2, 4, 8, 16, 32],
        "series": [
            {"label": "useful work", "y": [1.0, 1.7, 2.6, 3.4, 3.9, 4.1], "color": DATA},
            {"label": "coordination cost", "y": [0.1, 0.3, 0.8, 1.7, 3.2, 5.6], "color": WARN},
        ],
        "xlabel": "agent count",
        "ylabel": "relative units",
        "logx": True,
        "ylim": (0, 6.0),
    },
    "rag-retrieval-1": {
        "type": "funnel",
        "stages": ["index", "retrieve", "rerank", "compose", "verify"],
        "values": [1.00, 0.72, 0.46, 0.34, 0.28],
        "xlabel": "candidate mass retained",
        "xmax": 1.05,
    },
    "embeddings-representation-1": {
        "type": "scatter",
        "points": [
            {"label": "cat", "x": 0.22, "y": 0.72, "color": DATA},
            {"label": "kitten", "x": 0.30, "y": 0.78, "color": DATA},
            {"label": "invoice", "x": 0.72, "y": 0.28, "color": ACCENT},
            {"label": "receipt", "x": 0.80, "y": 0.34, "color": ACCENT},
            {"label": "hard negative", "x": 0.52, "y": 0.56, "color": WARN},
        ],
        "xlabel": "embedding dimension 1",
        "ylabel": "embedding dimension 2",
    },
    "context-engineering-1": {
        "type": "line",
        "x": [1, 2, 4, 8, 16, 32, 64],
        "series": [
            {"label": "raw dump", "y": [0.35, 0.48, 0.58, 0.60, 0.57, 0.50, 0.43], "color": WARN},
            {"label": "packed context", "y": [0.34, 0.50, 0.66, 0.78, 0.84, 0.86, 0.86], "color": DATA},
        ],
        "xlabel": "context budget",
        "ylabel": "task quality",
        "logx": True,
        "ylim": (0.30, 0.90),
    },
    "evaluating-agents-1": {
        "type": "line",
        "x": [1, 2, 4, 8, 16, 32],
        "series": [
            {"label": "unit eval", "y": [0.88, 0.84, 0.76, 0.64, 0.50, 0.38], "color": DATA},
            {"label": "task eval", "y": [0.80, 0.76, 0.70, 0.62, 0.54, 0.48], "color": ACCENT},
            {"label": "trajectory eval", "y": [0.62, 0.62, 0.61, 0.60, 0.59, 0.58], "color": WARN},
        ],
        "xlabel": "task horizon (steps)",
        "ylabel": "measured pass rate",
        "logx": True,
        "ylim": (0.30, 0.95),
    },
    "scalable-oversight-control-1": {
        "type": "line",
        "x": [1, 2, 4, 8, 16, 32],
        "series": [
            {"label": "human review", "y": [0.20, 0.35, 0.62, 1.05, 1.75, 2.9], "color": WARN},
            {"label": "assisted oversight", "y": [0.22, 0.30, 0.42, 0.58, 0.82, 1.15], "color": DATA},
        ],
        "xlabel": "model capability",
        "ylabel": "oversight cost",
        "logx": True,
    },
    "security-authorization-1": {
        "type": "line",
        "x": [0, 1, 2, 3, 4, 5],
        "series": [
            {"label": "ambient authority", "y": [1, 1, 1, 1, 1, 1], "color": WARN},
            {"label": "capability scoped", "y": [1.0, 0.72, 0.50, 0.35, 0.24, 0.17], "color": DATA},
        ],
        "xlabel": "delegation depth",
        "ylabel": "privilege retained",
        "ylim": (0, 1.05),
    },
    "runtime-safety-1": {
        "type": "line",
        "x": [0, 1, 2, 3, 4, 5],
        "series": [
            {"label": "false negatives", "y": [0.55, 0.38, 0.25, 0.16, 0.10, 0.07], "color": WARN},
            {"label": "false positives", "y": [0.06, 0.10, 0.17, 0.28, 0.42, 0.58], "color": DATA},
        ],
        "xlabel": "guardrail strictness",
        "ylabel": "error rate",
        "ylim": (0, 0.65),
    },
    "adversarial-robustness-1": {
        "type": "line",
        "x": [0, 1, 2, 3, 4, 5],
        "series": [
            {"label": "baseline", "y": [0.10, 0.24, 0.42, 0.62, 0.78, 0.88], "color": WARN},
            {"label": "hardened", "y": [0.06, 0.12, 0.23, 0.36, 0.52, 0.68], "color": DATA},
        ],
        "xlabel": "attack strength",
        "ylabel": "attack success rate",
        "ylim": (0, 0.95),
    },
    "privacy-provenance-unlearning-1": {
        "type": "line",
        "x": [0, 1, 2, 3, 4, 5],
        "series": [
            {"label": "without lineage", "y": [0.15, 0.35, 0.58, 0.76, 0.86, 0.92], "color": WARN},
            {"label": "tracked lineage", "y": [0.15, 0.28, 0.36, 0.31, 0.24, 0.18], "color": DATA},
        ],
        "xlabel": "data lifecycle stage",
        "ylabel": "residual exposure",
        "ylim": (0, 1.0),
    },
    "law-regulation-policy-1": {
        "type": "line",
        "x": [2022, 2023, 2024, 2025, 2026],
        "series": [
            {"label": "deployment speed", "y": [0.30, 0.44, 0.62, 0.78, 0.90], "color": DATA},
            {"label": "governance latency", "y": [0.20, 0.28, 0.40, 0.52, 0.62], "color": WARN},
        ],
        "xlabel": "year",
        "ylabel": "relative pace",
        "ylim": (0.15, 0.95),
    },
    "orchestration-data-infra-1": {
        "type": "line",
        "x": [2, 5, 10, 20, 40, 80],
        "series": [
            {"label": "checkpoint overhead", "y": [0.62, 0.36, 0.22, 0.14, 0.10, 0.08], "color": DATA},
            {"label": "lost work on failure", "y": [0.05, 0.09, 0.16, 0.30, 0.55, 0.95], "color": WARN},
        ],
        "xlabel": "checkpoint interval (minutes)",
        "ylabel": "cost per training hour",
        "logx": True,
        "ylim": (0, 1.05),
    },
    "the-compute-frontier-1": {
        "type": "line",
        "x": [2020, 2021, 2022, 2023, 2024, 2025, 2026],
        "series": [
            {"label": "FLOPs", "y": [1.0, 1.6, 2.5, 3.8, 5.7, 8.5, 12.5], "color": DATA},
            {"label": "memory bandwidth", "y": [1.0, 1.25, 1.55, 1.9, 2.35, 2.85, 3.4], "color": WARN},
        ],
        "xlabel": "accelerator generation",
        "ylabel": "relative growth",
        "ylim": (0.8, 13.5),
    },
    "making-the-silicon-1": {
        "type": "bars",
        "categories": ["wafer", "HBM", "CoWoS", "export"],
        "series": [
            {"label": "lead time", "values": [0.50, 0.78, 0.92, 0.65], "color": DATA},
            {"label": "policy risk", "values": [0.25, 0.45, 0.38, 0.88], "color": WARN},
        ],
        "ylabel": "constraint intensity",
        "ylim": (0, 1.05),
    },
    "powering-it-1": {
        "type": "line",
        "x": [2024, 2025, 2026, 2027, 2028, 2029, 2030],
        "series": [
            {"label": "AI load demand", "y": [1.0, 1.5, 2.2, 3.1, 4.2, 5.4, 6.8], "color": DATA},
            {"label": "power delivered", "y": [1.0, 1.18, 1.42, 1.75, 2.15, 2.65, 3.25], "color": WARN},
        ],
        "xlabel": "year",
        "ylabel": "relative capacity",
        "ylim": (0.8, 7.2),
    },
    "the-machine-that-breaks-1": {
        "type": "line",
        "x": [100, 1000, 10000, 100000, 1000000],
        "series": [
            {"label": "all healthy", "y": [0.99, 0.90, 0.37, 0.02, 0.00], "color": WARN},
            {"label": "with recovery", "y": [0.99, 0.97, 0.92, 0.84, 0.72], "color": DATA},
        ],
        "xlabel": "components in fleet",
        "ylabel": "job survival probability",
        "logx": True,
        "ylim": (0, 1.05),
    },
    "where-learning-hits-limits-1": {
        "type": "line",
        "x": [2024, 2025, 2026, 2027, 2028, 2029, 2030],
        "series": [
            {"label": "high-quality stock", "y": [1.0, 0.92, 0.80, 0.65, 0.50, 0.38, 0.30], "color": DATA},
            {"label": "training demand", "y": [0.35, 0.55, 0.82, 1.15, 1.55, 2.05, 2.70], "color": WARN},
        ],
        "xlabel": "year",
        "ylabel": "relative token pressure",
        "ylim": (0, 2.9),
    },
    "the-capability-horizon-1": {
        "type": "line",
        "x": [1, 2, 4, 8, 16, 32, 64],
        "series": [
            {"label": "short tasks", "y": [0.78, 0.80, 0.82, 0.83, 0.84, 0.84, 0.84], "color": DATA},
            {"label": "long tasks", "y": [0.18, 0.24, 0.34, 0.48, 0.63, 0.74, 0.80], "color": ACCENT},
        ],
        "xlabel": "model generation",
        "ylabel": "completion rate",
        "logx": True,
        "ylim": (0.10, 0.90),
    },
    "model-landscape-1": {
        "type": "scatter",
        "points": [
            {"label": "closed frontier", "x": 0.86, "y": 0.30, "color": DATA},
            {"label": "open weights", "x": 0.62, "y": 0.72, "color": ACCENT},
            {"label": "specialized", "x": 0.45, "y": 0.60, "color": WARN},
            {"label": "local small", "x": 0.25, "y": 0.84, "color": MUTED},
        ],
        "xlabel": "capability",
        "ylabel": "operator control",
    },
    "tooling-ecosystem-1": {
        "type": "stacked",
        "categories": ["model", "gateway", "tools", "memory", "eval"],
        "segments": [
            {"label": "runtime", "values": [0.70, 0.52, 0.45, 0.38, 0.30], "color": DATA},
            {"label": "governance", "values": [0.18, 0.34, 0.42, 0.46, 0.56], "color": ACCENT},
        ],
        "ylabel": "stack responsibility",
        "ylim": (0, 1.05),
    },
    "economics-1": {
        "type": "line",
        "x": [1, 3, 10, 30, 100, 300],
        "series": [
            {"label": "API", "y": [0.08, 0.18, 0.55, 1.55, 4.8, 13.5], "color": DATA},
            {"label": "self-host", "y": [2.0, 2.15, 2.5, 3.2, 5.4, 10.0], "color": WARN},
        ],
        "xlabel": "served tokens (relative)",
        "ylabel": "total cost",
        "logx": True,
    },
    "choosing-a-model-1": {
        "type": "scatter",
        "points": [
            {"label": "small", "x": 0.20, "y": 0.42, "color": MUTED},
            {"label": "cheap frontier", "x": 0.48, "y": 0.68, "color": ACCENT},
            {"label": "frontier", "x": 0.82, "y": 0.88, "color": DATA},
            {"label": "overkill", "x": 0.92, "y": 0.72, "color": WARN},
        ],
        "xlabel": "serving cost",
        "ylabel": "task quality",
    },
    "serving-and-compute-1": {
        "type": "line",
        "x": [1, 2, 4, 8, 16, 32, 64],
        "series": [
            {"label": "utilization", "y": [0.18, 0.32, 0.52, 0.70, 0.82, 0.90, 0.94], "color": DATA},
            {"label": "latency", "y": [0.10, 0.14, 0.22, 0.36, 0.58, 0.88, 1.25], "color": WARN},
        ],
        "xlabel": "batch size",
        "ylabel": "relative value",
        "logx": True,
        "ylim": (0, 1.35),
    },
    "edge-on-device-1": {
        "type": "bars",
        "categories": ["FP16", "INT8", "INT4", "distilled"],
        "series": [
            {"label": "memory", "values": [1.00, 0.54, 0.32, 0.22], "color": DATA},
            {"label": "quality loss", "values": [0.02, 0.08, 0.18, 0.30], "color": WARN},
        ],
        "ylabel": "relative budget",
        "ylim": (0, 1.08),
    },
    "training-finetuning-practice-1": {
        "type": "line",
        "x": [100, 300, 1000, 3000, 10000, 30000],
        "series": [
            {"label": "fine-tune", "y": [0.18, 0.34, 0.55, 0.70, 0.78, 0.82], "color": DATA},
            {"label": "from scratch", "y": [0.05, 0.10, 0.22, 0.42, 0.68, 0.86], "color": WARN},
        ],
        "xlabel": "task examples",
        "ylabel": "task quality",
        "logx": True,
        "ylim": (0, 0.92),
    },
    "agents-and-sandboxes-1": {
        "type": "scatter",
        "points": [
            {"label": "browser only", "x": 0.18, "y": 0.22, "color": MUTED},
            {"label": "container", "x": 0.42, "y": 0.54, "color": DATA},
            {"label": "ephemeral VM", "x": 0.68, "y": 0.76, "color": ACCENT},
            {"label": "privileged host", "x": 0.88, "y": 0.34, "color": WARN},
        ],
        "xlabel": "task freedom",
        "ylabel": "containment",
    },
    "retrieval-and-documents-1": {
        "type": "funnel",
        "stages": ["parse", "chunk", "embed", "retrieve", "cite"],
        "values": [1.00, 0.86, 0.74, 0.56, 0.44],
        "xlabel": "answerable evidence retained",
        "xmax": 1.05,
    },
    "evaluation-and-observability-1": {
        "type": "line",
        "x": [1, 2, 3, 4, 5],
        "series": [
            {"label": "offline evals", "y": [0.28, 0.42, 0.55, 0.64, 0.70], "color": DATA},
            {"label": "live telemetry", "y": [0.18, 0.34, 0.55, 0.76, 0.88], "color": ACCENT},
        ],
        "xlabel": "instrumentation depth",
        "ylabel": "issue detection",
        "ylim": (0.10, 0.95),
    },
    "wiring-a-2026-stack-1": {
        "type": "line",
        "x": [1, 2, 4, 8, 12, 16],
        "series": [
            {"label": "capability coverage", "y": [0.30, 0.48, 0.66, 0.78, 0.83, 0.86], "color": DATA},
            {"label": "integration risk", "y": [0.08, 0.15, 0.30, 0.58, 0.82, 1.05], "color": WARN},
        ],
        "xlabel": "stack components",
        "ylabel": "relative value",
        "ylim": (0, 1.12),
    },
    "deployment-lifecycle-1": {
        "type": "line",
        "x": [0, 1, 2, 3, 4, 5],
        "series": [
            {"label": "big bang deploy", "y": [0.12, 0.22, 0.42, 0.78, 0.60, 0.45], "color": WARN},
            {"label": "canary ramp", "y": [0.08, 0.10, 0.14, 0.22, 0.30, 0.34], "color": DATA},
        ],
        "xlabel": "release phase",
        "ylabel": "user-visible risk",
        "ylim": (0, 0.85),
    },
    "reliability-nondeterministic-1": {
        "type": "line",
        "x": [1, 2, 3, 5, 8, 13, 21],
        "series": [
            {"label": "p = 0.99", "y": [0.99, 0.98, 0.97, 0.95, 0.92, 0.88, 0.81], "color": DATA},
            {"label": "p = 0.95", "y": [0.95, 0.90, 0.86, 0.77, 0.66, 0.51, 0.34], "color": WARN},
        ],
        "xlabel": "dependent steps",
        "ylabel": "end-to-end success",
        "ylim": (0.30, 1.02),
    },
    "human-interface-oversight-1": {
        "type": "scatter",
        "points": [
            {"label": "suggest", "x": 0.16, "y": 0.24, "color": MUTED},
            {"label": "draft + edit", "x": 0.34, "y": 0.36, "color": DATA},
            {"label": "review gate", "x": 0.55, "y": 0.58, "color": ACCENT},
            {"label": "two-person verify", "x": 0.72, "y": 0.76, "color": WARN},
            {"label": "stop / rollback", "x": 0.88, "y": 0.88, "color": WARN},
        ],
        "xlabel": "action autonomy",
        "ylabel": "oversight burden",
    },
    "production-data-engine-1": {
        "type": "scatter",
        "points": [
            {"label": "batch", "x": 0.24, "y": 0.78, "color": DATA},
            {"label": "stream", "x": 0.72, "y": 0.46, "color": WARN},
            {"label": "curated stream", "x": 0.60, "y": 0.70, "color": ACCENT},
            {"label": "raw firehose", "x": 0.88, "y": 0.22, "color": MUTED},
        ],
        "xlabel": "freshness",
        "ylabel": "quality control",
    },
    "operating-contracts-1": {
        "type": "line",
        "x": [0, 1, 2, 3, 4, 5],
        "series": [
            {"label": "governed stack", "y": [0.78, 0.58, 0.42, 0.31, 0.25, 0.21], "color": DATA},
            {"label": "ad hoc stack", "y": [0.78, 0.72, 0.68, 0.65, 0.63, 0.61], "color": WARN},
        ],
        "xlabel": "contract coverage",
        "ylabel": "unpriced risk",
        "ylim": (0.15, 0.85),
    },
    "model-landscape-2": {
        "type": "bars",
        "categories": ["open source AI", "open weights", "API only"],
        "series": [
            {"label": "use / modify / share", "values": [0.95, 0.78, 0.28], "color": DATA},
            {"label": "study / reproduce", "values": [0.90, 0.42, 0.12], "color": ACCENT},
            {"label": "audit data path", "values": [0.82, 0.18, 0.06], "color": WARN},
        ],
        "ylabel": "practical openness",
        "ylim": (0, 1.08),
        "rotation": 10,
        "ha": "right",
    },
    "tooling-ecosystem-2": {
        "type": "scatter",
        "points": [
            {"label": "model gateway", "x": 0.22, "y": 0.72, "color": DATA},
            {"label": "MCP server", "x": 0.47, "y": 0.58, "color": ACCENT},
            {"label": "A2A agent", "x": 0.69, "y": 0.44, "color": WARN},
            {"label": "sandbox runtime", "x": 0.54, "y": 0.80, "color": DATA},
            {"label": "workflow registry", "x": 0.82, "y": 0.28, "color": MUTED},
        ],
        "xlabel": "interop boundary crossed",
        "ylabel": "local control retained",
    },
    "economics-2": {
        "type": "line",
        "x": [0, 1, 2, 3, 4, 5, 6],
        "series": [
            {"label": "frontier training cost", "y": [1.0, 2.4, 5.8, 13.8, 33.2, 79.6, 191.1], "color": WARN},
            {"label": "economy token price", "y": [1.0, 0.53, 0.28, 0.15, 0.08, 0.04, 0.02], "color": DATA},
        ],
        "xlabel": "years",
        "ylabel": "relative index",
        "logy": True,
        "legend": "center left",
        "ylim": (0.015, 260),
    },
    "market-structure-1": {
        "type": "stacked",
        "categories": ["silicon", "cloud", "frontier labs", "API", "apps", "data"],
        "segments": [
            {"label": "capital intensity", "values": [0.85, 0.72, 0.78, 0.38, 0.18, 0.20], "color": DATA},
            {"label": "switching cost", "values": [0.28, 0.55, 0.42, 0.48, 0.62, 0.50], "color": ACCENT},
            {"label": "differentiation", "values": [0.32, 0.26, 0.58, 0.34, 0.68, 0.72], "color": WARN},
        ],
        "ylabel": "control pressure",
        "ylim": (0, 2.15),
        "legend": "upper right",
    },
    "adoption-productivity-1": {
        "type": "line",
        "x": [0, 1, 2, 3, 4, 5, 6],
        "series": [
            {"label": "AI-assisted lift", "y": [0.10, 0.28, 0.42, 0.34, 0.10, -0.08, -0.18], "color": DATA, "marker": "o"},
            {"label": "review burden", "y": [0.03, 0.08, 0.15, 0.24, 0.34, 0.46, 0.58], "color": WARN, "style": "--"},
        ],
        "xlabel": "task distance from the frontier",
        "ylabel": "net productivity effect",
        "ylim": (-0.25, 0.65),
        "grid": True,
        "annotations": [
            {"text": "jagged edge", "xy": (4.0, 0.10), "xytext": (3.2, 0.42)}
        ],
    },
    "data-rights-economics-1": {
        "type": "funnel",
        "stages": ["raw web", "policy-usable", "licensed / consented", "documented", "production-ready"],
        "values": [100, 72, 46, 31, 24],
        "xlabel": "relative corpus available",
        "xmax": 110,
        "colors": [DATA, ACCENT, WARN, MUTED, "#6b7280"],
    },
}


RENDERERS = {
    "line": _line,
    "bars": _bars,
    "stacked": _stacked,
    "scatter": _scatter,
    "funnel": _funnel,
}


def render(name):
    spec = SPECS[name]
    RENDERERS[spec["type"]](name, spec)


if __name__ == "__main__":
    for item in sys.argv[1:] or sorted(SPECS):
        render(item)
