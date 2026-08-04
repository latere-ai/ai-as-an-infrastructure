import matplotlib

matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch

from common import ACCENT, DATA, INK, MUTED, WARN, save_bilingual


MAIN_Y = 0.67
CHECK_Y = 0.22
BOX_H = 0.15

MAIN_FLOW = [
    ("request", 0.025, 0.13, DATA),
    ("translator", 0.205, 0.15, DATA),
    ("artifact", 0.405, 0.14, ACCENT),
    ("executor", 0.595, 0.14, ACCENT),
    ("result", 0.785, 0.12, WARN),
]


def box(ax, x, y, w, h, text, color, fontsize=9.8):
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
    ax.text(
        x + w / 2,
        y + h / 2,
        text,
        ha="center",
        va="center",
        color=INK,
        fontsize=fontsize,
    )


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


fig, ax = plt.subplots(figsize=(5.2, 3.2))
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis("off")

for label, x, w, color in MAIN_FLOW:
    box(ax, x, MAIN_Y, w, BOX_H, label, color)

for (_, x1, w1, _), (_, x2, _, _) in zip(MAIN_FLOW, MAIN_FLOW[1:]):
    arrow(ax, x1 + w1, MAIN_Y + BOX_H / 2, x2, MAIN_Y + BOX_H / 2)

check_x = 0.45
check_w = 0.21
accept_x = 0.79
accept_w = 0.12
box(ax, check_x, CHECK_Y, check_w, 0.15, "task check", MUTED, fontsize=9.6)
box(ax, accept_x, CHECK_Y, accept_w, 0.15, "accept", WARN, fontsize=9.6)
arrow(ax, check_x + check_w, CHECK_Y + 0.075, accept_x, CHECK_Y + 0.075, color=WARN)

request_x = MAIN_FLOW[0][1] + MAIN_FLOW[0][2] / 2
translator_x = MAIN_FLOW[1][1] + MAIN_FLOW[1][2] / 2
artifact_x = MAIN_FLOW[2][1] + MAIN_FLOW[2][2] / 2
result_x = MAIN_FLOW[4][1] + MAIN_FLOW[4][2] / 2

arrow(ax, request_x, MAIN_Y, check_x + 0.035, CHECK_Y + 0.15, color=MUTED, alpha=0.7)
arrow(ax, artifact_x, MAIN_Y, check_x + check_w / 2, CHECK_Y + 0.15, color=MUTED, alpha=0.7)
arrow(ax, result_x, MAIN_Y, check_x + check_w - 0.035, CHECK_Y + 0.15, color=MUTED, alpha=0.7)

ax.plot(
    [check_x, translator_x, translator_x],
    [CHECK_Y + 0.055, CHECK_Y + 0.055, MAIN_Y],
    color=MUTED,
    linewidth=1.0,
    linestyle="--",
    alpha=0.72,
)
arrow(
    ax,
    translator_x,
    CHECK_Y + 0.055,
    translator_x,
    MAIN_Y,
    color=MUTED,
    dashed=True,
    alpha=0.72,
)
ax.text(
    0.365,
    CHECK_Y + 0.01,
    "repair",
    ha="center",
    va="center",
    color=INK,
    fontsize=9.4,
)

fig.tight_layout()
save_bilingual(fig, "programs-solvers-symbolic-1")
