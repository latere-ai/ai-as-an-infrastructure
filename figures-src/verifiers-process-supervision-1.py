import matplotlib

matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

from common import ACCENT, DATA, INK, MUTED, WARN, save_bilingual


AXES = [
    (
        "signal location",
        [("terminal outcome", DATA), ("intermediate process", ACCENT)],
    ),
    (
        "judgment source",
        [("explicit rule", DATA), ("learned model", WARN), ("human review", MUTED)],
    ),
    (
        "return type",
        [("decision", DATA), ("score", WARN), ("critique", MUTED), ("certificate", ACCENT)],
    ),
]


fig, ax = plt.subplots(figsize=(6.2, 3.25))
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis("off")

ax.text(
    0.02,
    0.94,
    "three independent verifier choices",
    color=INK,
    fontsize=10,
    fontweight="bold",
    va="top",
)

row_y = [0.69, 0.42, 0.15]
box_left = 0.27
box_right = 0.98
gap = 0.018

for (label, options), y in zip(AXES, row_y):
    ax.text(0.02, y + 0.06, label, color=INK, fontsize=8.5, va="center")
    width = (box_right - box_left - gap * (len(options) - 1)) / len(options)
    for index, (option, color) in enumerate(options):
        x = box_left + index * (width + gap)
        patch = FancyBboxPatch(
            (x, y),
            width,
            0.12,
            boxstyle="round,pad=0.008,rounding_size=0.018",
            facecolor=color,
            edgecolor=color,
            alpha=0.14,
            linewidth=1.0,
        )
        ax.add_patch(patch)
        ax.text(
            x + width / 2,
            y + 0.06,
            option,
            color=INK,
            fontsize=7.8,
            ha="center",
            va="center",
        )

ax.text(
    0.27,
    0.04,
    "examples combine one choice from each row",
    color=MUTED,
    fontsize=7.5,
    va="center",
)

fig.tight_layout(pad=0.55)
save_bilingual(fig, "verifiers-process-supervision-1")
