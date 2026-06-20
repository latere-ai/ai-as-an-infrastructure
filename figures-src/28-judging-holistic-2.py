import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic verbosity bias. Content quality is held fixed across the whole
# x-axis, so a fair judge would award a flat 0.5 win rate. Instead the judge
# rewards length, and its win rate climbs with answer length: the entire gap
# above the dashed 0.5 line is pure bias, not genuine quality. This is an
# idealized curve, not measured data.

INK = "#6b7280"
DATA = "#3b82f6"

# Length of the longer answer relative to a fixed-quality baseline (1x = same).
length_ratio = np.linspace(1.0, 5.0, 300)

# A fair judge would sit flat at 0.5 since quality is fixed. The biased judge
# drifts upward, saturating as extra padding stops helping.
bias = 0.40 * (1.0 - np.exp(-(length_ratio - 1.0) / 1.3))
win_rate = 0.5 + bias

fig, ax = plt.subplots(figsize=(5, 3))

# What a fair judge should report at fixed quality.
ax.axhline(0.5, color=INK, lw=1.0, alpha=0.6, ls="--", zorder=1)
ax.text(4.95, 0.515, "fair judge (quality fixed)", color=INK, fontsize=8,
        ha="right", va="bottom")

# The biased judge.
ax.plot(length_ratio, win_rate, color=DATA, lw=1.8, zorder=2)

# Shade the gap that is pure bias.
ax.fill_between(length_ratio, 0.5, win_rate, color=DATA, alpha=0.10, zorder=1)
ax.annotate("pure bias", xy=(3.4, 0.5 + 0.5 * (win_rate[200] - 0.5)),
            xytext=(2.0, 0.85), color=INK, fontsize=9,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xlim(1.0, 5.0)
ax.set_ylim(0.45, 1.0)
ax.set_xlabel("answer length (relative to fixed-quality baseline)", color=INK)
ax.set_ylabel("judge win rate for the longer answer", color=INK)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

fig.tight_layout()
for _out in (
    "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/en/figures/28-judging-holistic-2.svg",
    "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/zh/figures/28-judging-holistic-2.svg",
):
    fig.savefig(_out, format="svg", bbox_inches="tight", transparent=True)
