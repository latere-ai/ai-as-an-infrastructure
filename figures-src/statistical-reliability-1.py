import matplotlib

matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

from common import DATA, ACCENT, WARN, INK, save_bilingual

# Schematic: two evaluation score estimates with 95% confidence intervals.
# The means can be ordered while the intervals still overlap enough that a
# release decision should treat the apparent win as uncertain.

labels = ["Model A", "Model B", "Model C"]
means = np.array([0.714, 0.728, 0.761])
half = np.array([0.018, 0.019, 0.011])
x = np.arange(len(labels))

fig, ax = plt.subplots(figsize=(5.1, 3.0))
ax.errorbar(x, means * 100, yerr=half * 100, fmt="o", color=DATA, ecolor=INK, elinewidth=1.2, capsize=4)
ax.axhspan((means[0] - half[0]) * 100, (means[1] + half[1]) * 100, color=INK, alpha=0.08)
ax.scatter([2], [means[2] * 100], s=70, facecolors="none", edgecolors=ACCENT, linewidths=1.8, zorder=3)
ax.annotate(
    "visible gap, weak evidence",
    xy=(0.5, 72.2),
    xytext=(0.22, 75.8),
    fontsize=8.5,
    color=INK,
    arrowprops=dict(arrowstyle="->", color=INK, lw=0.9),
)
ax.annotate(
    "clearer separation",
    xy=(2.0, means[2] * 100),
    xytext=(1.35, 77.4),
    fontsize=8.5,
    color=INK,
    arrowprops=dict(arrowstyle="->", color=INK, lw=0.9),
)
ax.set_xticks(x)
ax.set_xticklabels(labels)
ax.set_ylabel("score estimate with 95% CI")
ax.set_ylim(68, 79)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK)
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)
fig.tight_layout()
save_bilingual(fig, "statistical-reliability-1")

