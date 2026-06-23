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
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", color=INK, fontsize=8.2)


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


fig, ax = plt.subplots(figsize=(6.4, 3.0))
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis("off")

top = [
    (0.02, "base model", DATA),
    (0.225, "trace pool", DATA),
    (0.43, "checker", ACCENT),
    (0.635, "accepted", ACCENT),
    (0.84, "train", WARN),
]
for x, label, color in top:
    box(ax, x, 0.57, 0.13, 0.16, label, color)

for x1, x2 in [(0.15, 0.225), (0.355, 0.43), (0.56, 0.635), (0.765, 0.84)]:
    arrow(ax, x1, 0.65, x2, 0.65)

ax.text(0.51, 0.43, "rejected traces", ha="center", va="center", color=INK, fontsize=8)
arrow(ax, 0.495, 0.57, 0.495, 0.47, color=MUTED, ls="--")

box(ax, 0.16, 0.18, 0.14, 0.15, "long teacher", DATA)
box(ax, 0.43, 0.18, 0.16, 0.15, "long-to-short", ACCENT)
box(ax, 0.72, 0.18, 0.14, 0.15, "short student", WARN)
arrow(ax, 0.30, 0.255, 0.43, 0.255)
arrow(ax, 0.59, 0.255, 0.72, 0.255)
arrow(ax, 0.70, 0.57, 0.79, 0.33, color=MUTED, rad=-0.15)

fig.tight_layout()
save_bilingual(fig, "reasoning-data-distillation-1")
