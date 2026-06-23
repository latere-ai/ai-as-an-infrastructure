import matplotlib

matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

from common import ACCENT, DATA, INK, MUTED, WARN, save_bilingual


MAIN_Y = 0.58
REPAIR_Y = 0.22
BOX_H = 0.18

MAIN_FLOW = [
    ("task", 0.045, 0.125, DATA),
    ("model", 0.245, 0.125, DATA),
    ("artifact", 0.445, 0.155, ACCENT),
    ("runtime", 0.655, 0.135, ACCENT),
    ("answer", 0.855, 0.115, WARN),
]


def box(ax, x, y, w, h, text, color, fontsize=8.8):
    patch = FancyBboxPatch(
        (x, y),
        w,
        h,
        boxstyle="round,pad=0.018,rounding_size=0.025",
        linewidth=1.25,
        edgecolor=color,
        facecolor="none",
    )
    ax.add_patch(patch)
    ax.text(x + w / 2, y + h / 2, text, ha="center", va="center", color=INK, fontsize=fontsize)


def arrow(ax, x1, y1, x2, y2, color=INK, dashed=False, alpha=0.86):
    ax.add_patch(
        FancyArrowPatch(
            (x1, y1),
            (x2, y2),
            arrowstyle="-|>",
            mutation_scale=9,
            linewidth=1.05,
            color=color,
            linestyle="--" if dashed else "-",
            alpha=alpha,
            shrinkA=5,
            shrinkB=5,
            zorder=2,
        )
    )


def dashed_segment(ax, x1, y1, x2, y2):
    ax.plot([x1, x2], [y1, y2], color=MUTED, linewidth=1.05, linestyle="--", alpha=0.72, zorder=1)


fig, ax = plt.subplots(figsize=(7.0, 2.75))
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis("off")

for label, x, w, color in MAIN_FLOW:
    box(ax, x, MAIN_Y, w, BOX_H, label, color)

for (_, x1, w1, _), (_, x2, _, _) in zip(MAIN_FLOW, MAIN_FLOW[1:]):
    arrow(ax, x1 + w1, MAIN_Y + BOX_H / 2, x2, MAIN_Y + BOX_H / 2, color=INK)

ax.text(0.315, 0.86, "translation", ha="center", va="center", color=INK, fontsize=8.6)
ax.text(0.705, 0.86, "execution", ha="center", va="center", color=INK, fontsize=8.6)

check_x = 0.66
check_w = 0.16
box(ax, check_x, REPAIR_Y, check_w, 0.14, "check", MUTED, fontsize=8.6)

runtime_center_x = 0.655 + 0.135 / 2
check_center_x = check_x + check_w / 2
check_center_y = REPAIR_Y + 0.07
model_center_x = 0.245 + 0.125 / 2

arrow(ax, runtime_center_x, MAIN_Y, check_center_x, REPAIR_Y + 0.14, color=MUTED, alpha=0.72)
dashed_segment(ax, check_x, check_center_y, model_center_x, check_center_y)
arrow(ax, model_center_x, check_center_y, model_center_x, MAIN_Y, color=MUTED, dashed=True, alpha=0.72)
ax.text((check_x + model_center_x) / 2, check_center_y - 0.07, "repair", ha="center", va="center", color=INK, fontsize=8.2)

fig.tight_layout()
save_bilingual(fig, "programs-solvers-symbolic-1")
