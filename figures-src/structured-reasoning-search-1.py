import matplotlib

matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch

from common import ACCENT, DATA, INK, MUTED, WARN, save_bilingual


SUBTLE = "#d1d5db"

LANES = [
    ("chain", 0.82),
    ("tree search", 0.61),
    ("graph reuse", 0.40),
    ("value-guided", 0.19),
]


def lane_label(ax, text, y):
    ax.text(0.045, y, text, ha="left", va="center", color=INK, fontsize=9.5, fontweight="bold")


def node(ax, x, y, color, filled=True, size=76):
    ax.scatter(
        [x],
        [y],
        s=size,
        facecolors=color if filled else "none",
        edgecolors=color,
        linewidths=1.35,
        zorder=4,
    )


def edge(ax, x1, y1, x2, y2, color=DATA, alpha=0.78, lw=1.05):
    ax.add_patch(
        FancyArrowPatch(
            (x1, y1),
            (x2, y2),
            arrowstyle="-|>",
            mutation_scale=8.5,
            linewidth=lw,
            color=color,
            alpha=alpha,
            shrinkA=6,
            shrinkB=6,
            zorder=2,
        )
    )


def chain(ax, y):
    xs = [0.30, 0.43, 0.56, 0.69, 0.82]
    for i, x in enumerate(xs):
        node(ax, x, y, ACCENT if i == len(xs) - 1 else DATA)
        if i:
            edge(ax, xs[i - 1], y, x, y)


def tree(ax, y):
    root = (0.31, y)
    kept = [(0.44, y - 0.045), (0.57, y - 0.015), (0.72, y + 0.035)]
    pruned = [(0.44, y + 0.045), (0.57, y + 0.075), (0.72, y - 0.060)]

    node(ax, *root, DATA)
    edge(ax, *root, *pruned[0], color=MUTED, alpha=0.35)
    edge(ax, *root, *kept[0])
    node(ax, *pruned[0], MUTED, filled=False)
    node(ax, *kept[0], DATA)

    edge(ax, *kept[0], *pruned[1], color=MUTED, alpha=0.35)
    edge(ax, *kept[0], *kept[1])
    node(ax, *pruned[1], MUTED, filled=False)
    node(ax, *kept[1], DATA)

    edge(ax, *kept[1], *kept[2])
    edge(ax, *kept[1], *pruned[2], color=MUTED, alpha=0.35)
    node(ax, *kept[2], ACCENT)
    node(ax, *pruned[2], WARN, filled=False)


def graph(ax, y):
    points = [
        (0.31, y + 0.055),
        (0.31, y - 0.055),
        (0.46, y),
        (0.60, y + 0.055),
        (0.60, y - 0.055),
        (0.75, y),
        (0.88, y),
    ]
    for i, point in enumerate(points):
        node(ax, *point, ACCENT if i == len(points) - 1 else DATA)
    for a, b in [(0, 2), (1, 2), (2, 3), (2, 4), (3, 5), (4, 5), (5, 6)]:
        edge(ax, *points[a], *points[b])


def value_guided(ax, y):
    xs = [0.31, 0.44, 0.57, 0.70, 0.83]
    heights = [0.03, 0.10, 0.05, 0.14, 0.025]
    colors = [DATA, ACCENT, DATA, ACCENT, MUTED]
    for i, (x, h, color) in enumerate(zip(xs, heights, colors)):
        filled = color != MUTED
        node(ax, x, y, color, filled=filled)
        ax.vlines(x, y - 0.035 - h, y - 0.035, colors=color, linewidth=2.0, zorder=3)
        if i:
            edge(ax, xs[i - 1], y, x, y, color=DATA if filled else MUTED, alpha=0.78 if filled else 0.35)


fig, ax = plt.subplots(figsize=(5.0, 3.5))
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis("off")

for label, y in LANES:
    lane_label(ax, label, y)

for y in [0.715, 0.505, 0.295]:
    ax.hlines(y, 0.035, 0.94, color=SUBTLE, linewidth=0.65, alpha=0.75)

chain(ax, LANES[0][1])
tree(ax, LANES[1][1])
graph(ax, LANES[2][1])
value_guided(ax, LANES[3][1])

fig.tight_layout()
save_bilingual(fig, "structured-reasoning-search-1")
