import sys

import numpy as np
from matplotlib.ticker import MaxNLocator

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
    if spec.get("xint"):
        # Integer-only x ticks (e.g. calendar years): no 2022.5 half-steps.
        ax.xaxis.set_major_locator(MaxNLocator(integer=True))
    ax.set_xlabel(spec["xlabel"], color=INK)
    ax.set_ylabel(spec["ylabel"], color=INK)
    if "xlim" in spec:
        ax.set_xlim(*spec["xlim"])
    if "ylim" in spec:
        ax.set_ylim(*spec["ylim"])
    if "xticks" in spec:
        ax.set_xticks(spec["xticks"])
    if "yticks" in spec:
        ax.set_yticks(spec["yticks"])
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


SPECS = {
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
    "nar-diffusion-lms-1": {
        "type": "line",
        "x": [8, 16, 32, 64, 128, 256],
        "series": [
            {"label": "autoregressive", "y": [8, 16, 32, 64, 128, 256], "color": DATA, "marker": "o"},
            {"label": "iterative NAR", "y": [8, 8, 8, 8, 8, 8], "color": ACCENT, "marker": "o"},
        ],
        "xlabel": "output length (tokens)",
        "ylabel": "dependent steps",
        "xlim": (0, 268),
        "ylim": (0, 268),
        "xticks": [0, 64, 128, 192, 256],
        "yticks": [0, 64, 128, 192, 256],
        "legend": "upper left",
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
}


RENDERERS = {
    "line": _line,
    "scatter": _scatter,
}


def render(name):
    spec = SPECS[name]
    RENDERERS[spec["type"]](name, spec)


if __name__ == "__main__":
    for item in sys.argv[1:] or sorted(SPECS):
        render(item)
