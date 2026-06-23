import matplotlib

matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

from common import ACCENT, DATA, INK, MUTED, WARN, save_bilingual


def box(ax, x, y, w, h, text, color=MUTED, lw=1.0):
    patch = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle="round,pad=0.02,rounding_size=0.025",
        linewidth=lw,
        edgecolor=color,
        facecolor="none",
    )
    ax.add_patch(patch)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", color=INK, fontsize=8)


def node(ax, x, y, color, filled=True):
    ax.scatter(
        [x],
        [y],
        s=74,
        facecolors=color if filled else "none",
        edgecolors=color,
        linewidths=1.2,
        zorder=3,
    )


def edge(ax, x1, y1, x2, y2, color=INK, ls="-", alpha=0.8):
    ax.add_patch(
        FancyArrowPatch(
            (x1, y1),
            (x2, y2),
            arrowstyle="-|>",
            mutation_scale=8,
            linewidth=0.9,
            color=color,
            linestyle=ls,
            alpha=alpha,
            shrinkA=5,
            shrinkB=5,
        )
    )


fig, ax = plt.subplots(figsize=(6.4, 3.2))
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis("off")

box(ax, 0.03, 0.84, 0.12, 0.12, "prompt", color=INK)

rows = [
    ("chain", 0.78),
    ("tree frontier", 0.58),
    ("graph reuse", 0.37),
    ("value-guided", 0.17),
]
for label, y in rows:
    ax.text(0.04, y, label, ha="left", va="center", color=INK, fontsize=8.5)

# Chain: one committed path.
chain_x = [0.25, 0.38, 0.51, 0.64, 0.77]
for i, x in enumerate(chain_x):
    node(ax, x, rows[0][1], DATA if i < 4 else ACCENT)
    if i:
        edge(ax, chain_x[i - 1], rows[0][1], x, rows[0][1], color=DATA)

# Tree: surviving frontier plus pruned branches.
y = rows[1][1]
node(ax, 0.27, y, DATA)
for x2, y2, c, keep in [
    (0.40, y + 0.08, MUTED, False),
    (0.40, y - 0.08, DATA, True),
    (0.54, y + 0.10, MUTED, False),
    (0.54, y - 0.02, DATA, True),
    (0.68, y + 0.04, ACCENT, True),
    (0.68, y - 0.10, WARN, False),
]:
    parent = 0.27 if x2 == 0.40 else (0.40 if x2 == 0.54 else 0.54)
    py = y if x2 == 0.40 else (y - 0.08 if x2 == 0.54 else y - 0.02)
    edge(ax, parent, py, x2, y2, color=DATA if keep else MUTED, alpha=0.8 if keep else 0.35)
    node(ax, x2, y2, c, filled=keep)
ax.text(0.72, y + 0.08, "selected frontier", ha="left", va="center", color=INK, fontsize=8)
ax.text(0.72, y - 0.10, "dead branches", ha="left", va="center", color=INK, fontsize=8)

# Graph: merge partial work instead of duplicating it.
y = rows[2][1]
points = [(0.27, y), (0.41, y + 0.07), (0.41, y - 0.07), (0.56, y), (0.70, y + 0.07), (0.70, y - 0.07)]
for x, yy in points:
    node(ax, x, yy, DATA if x < 0.65 else ACCENT)
for a, b in [(0, 1), (0, 2), (1, 3), (2, 3), (3, 4), (3, 5), (4, 5)]:
    edge(ax, *points[a], *points[b], color=DATA, alpha=0.75)

# Value guidance: score partial states before fully expanding them.
y = rows[3][1]
for x, h, c in [(0.27, 0.03, DATA), (0.40, 0.10, ACCENT), (0.53, 0.05, DATA), (0.66, 0.16, ACCENT), (0.79, 0.02, MUTED)]:
    node(ax, x, y, c, filled=c != MUTED)
    ax.vlines(x, y + 0.035, y + 0.035 + h, colors=c, linewidth=2)
for x1, x2 in zip([0.27, 0.40, 0.53, 0.66], [0.40, 0.53, 0.66, 0.79]):
    edge(ax, x1, y, x2, y, color=DATA if x2 < 0.79 else MUTED, alpha=0.7)
ax.text(0.84, y + 0.10, "compute well spent", ha="left", va="center", color=INK, fontsize=8)
ax.text(0.84, y - 0.02, "compute wasted", ha="left", va="center", color=INK, fontsize=8)

fig.tight_layout()
save_bilingual(fig, "structured-reasoning-search-1")
