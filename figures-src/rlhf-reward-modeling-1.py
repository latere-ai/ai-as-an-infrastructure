import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic proxy-overoptimization curve. Gao et al. (2022) used an independent
# gold reward model as a controlled stand-in for human judgment. The chart is a
# toy quadratic in the qualitative form of their RL fit, not measured data and
# not a claim about a universal curve of true human quality.

INK = "#6b7280"
DATA = "#3b82f6"

shift = np.linspace(0.0, 10.0, 400)
proxy = 0.35 + 0.12 * shift
curvature = 0.016  # illustrative; not a fitted value from the paper
gold = 0.45 + 0.16 * shift - curvature * shift**2

peak_idx = int(np.argmax(gold))
knee = float(shift[peak_idx])
gold_peak = float(gold[peak_idx])

fig, ax = plt.subplots(figsize=(5, 3))

# Over-optimized region: everything to the right of the knee.
ax.axvspan(knee, shift.max(), color=INK, alpha=0.06, zorder=0)

# Both quantities share the one data color; linestyle distinguishes them.
ax.plot(shift, proxy, color=DATA, lw=1.8, zorder=3,
        label="optimized proxy score")
ax.plot(shift, gold, color=DATA, lw=1.8, ls=(0, (5, 2)), zorder=3,
        label="independent gold-model score")

# Mark the point where the independent check peaks.
ax.axvline(knee, color=INK, lw=0.9, ls=":", zorder=2)
ax.scatter([knee], [gold_peak], s=30, color=DATA, zorder=4)
ax.annotate("gold-model peak", xy=(knee, gold_peak),
            xytext=(knee - 2.8, gold_peak + 0.14),
            color=INK, fontsize=9,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))
ax.text(knee + 1.4, 1.27, "proxy keeps rising", color=INK, fontsize=9,
        ha="center")

ax.set_xlabel("policy shift from reference", color=INK)
ax.set_ylabel("score (illustrative units)", color=INK)
ax.set_ylim(0.35, 1.6)
ax.set_xlim(0, shift.max())

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

leg = ax.legend(frameon=False, fontsize=8, loc="lower right")
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "rlhf-reward-modeling-1")
