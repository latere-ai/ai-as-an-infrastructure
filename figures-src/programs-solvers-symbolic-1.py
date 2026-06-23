import matplotlib

matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

from common import ACCENT, DATA, INK, MUTED, WARN, save_bilingual


def box(ax, x, y, w, h, text, color):
    patch = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle="round,pad=0.02,rounding_size=0.025",
        linewidth=1.2,
        edgecolor=color,
        facecolor="none",
    )
    ax.add_patch(patch)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", color=INK, fontsize=8.5)


def arrow(ax, x1, y1, x2, y2, color=INK, ls="-", rad=0.0):
    ax.add_patch(
        FancyArrowPatch(
            (x1, y1),
            (x2, y2),
            arrowstyle="-|>",
            mutation_scale=9,
            connectionstyle=f"arc3,rad={rad}",
            linewidth=1.0,
            color=color,
            linestyle=ls,
            shrinkA=5,
            shrinkB=5,
        )
    )


fig, ax = plt.subplots(figsize=(6.2, 2.8))
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis("off")

items = [
    (0.04, "task", DATA),
    (0.25, "model", DATA),
    (0.46, "artifact", ACCENT),
    (0.67, "runtime", ACCENT),
    (0.84, "answer", WARN),
]
for x, label, color in items:
    box(ax, x, 0.48, 0.13, 0.18, label, color)

for x1, x2 in [(0.17, 0.25), (0.38, 0.46), (0.59, 0.67), (0.80, 0.84)]:
    arrow(ax, x1, 0.57, x2, 0.57, color=INK)

ax.text(0.305, 0.77, "learned translation", ha="center", va="center", color=INK, fontsize=8)
ax.text(0.525, 0.77, "program / query / proof", ha="center", va="center", color=INK, fontsize=8)
ax.text(0.735, 0.77, "exact execution", ha="center", va="center", color=INK, fontsize=8)

box(ax, 0.46, 0.17, 0.13, 0.14, "runtime check", MUTED)
arrow(ax, 0.735, 0.48, 0.525, 0.31, color=MUTED, rad=-0.12)
arrow(ax, 0.46, 0.24, 0.315, 0.48, color=MUTED, ls="--", rad=0.18)
ax.text(0.39, 0.19, "repair loop", ha="center", va="center", color=INK, fontsize=8)

fig.tight_layout()
save_bilingual(fig, "programs-solvers-symbolic-1")
