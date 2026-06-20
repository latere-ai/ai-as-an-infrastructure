import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic Bradley-Terry / Elo win-probability curve. The probability that
# model i beats model j is a logistic function of the rating gap, with the
# 400-point Elo scale fixing the slope: a gap of 0 is a coin flip, a gap of
# 400 gives roughly a 91 percent win probability. This is the exact formula
# from the chapter plotted over an idealized range, not measured data.

INK = "#6b7280"
DATA = "#3b82f6"

delta = np.linspace(-800, 800, 400)          # rating gap r_i - r_j
p = 1.0 / (1.0 + 10.0 ** (-delta / 400.0))    # P(i beats j)

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(delta, p, color=DATA, lw=1.8, zorder=2)

# Anchor the two reference points the text calls out.
ax.axhline(0.5, color=INK, lw=0.8, alpha=0.4, ls="--", zorder=1)
ax.axvline(0.0, color=INK, lw=0.8, alpha=0.4, ls="--", zorder=1)
ax.scatter([0.0], [0.5], s=30, color=DATA, zorder=3)
ax.annotate("equal ratings,\ncoin flip", xy=(0.0, 0.5),
            xytext=(-760, 0.66), color=INK, fontsize=9,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

p400 = 1.0 / (1.0 + 10.0 ** (-400.0 / 400.0))
ax.scatter([400.0], [p400], s=30, color=DATA, zorder=3)
ax.annotate("400-point gap,\nabout 0.91", xy=(400.0, p400),
            xytext=(120, 0.30), color=INK, fontsize=9,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xlim(-800, 800)
ax.set_ylim(0.0, 1.0)
ax.set_xlabel("rating gap  r_i - r_j", color=INK)
ax.set_ylabel("P(model i beats model j)", color=INK)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

fig.tight_layout()
for _out in (
    "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/en/figures/28-judging-holistic-1.svg",
    "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/zh/figures/28-judging-holistic-1.svg",
):
    fig.savefig(_out, format="svg", bbox_inches="tight", transparent=True)
