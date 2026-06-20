import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic critical batch size: training speedup (samples of progress per
# optimizer step, normalized) rises almost linearly with batch size, then
# saturates. Past the critical batch size you spend more compute per step
# for almost no extra progress. This is idealized synthetic data.

INK = "#6b7280"
DATA = "#3b82f6"

# McCandlish et al. give a hyperbolic form: speedup S(B) = 1 / (1 + B_crit / B)
# in steps saved, equivalently progress per step ~ B / (B + B_crit).
B_crit = 1.0
B = np.logspace(-2, 2.3, 300)            # batch size in units of B_crit
speedup = B / (B + B_crit)               # normalized progress per step (0..1)

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(B, speedup, color=DATA, lw=1.8, zorder=2)

# Mark the critical batch size where returns start to bend over (B = B_crit,
# speedup = 0.5 of the asymptote).
ax.axvline(B_crit, color=INK, lw=1.0, ls="--", alpha=0.55, zorder=1)
ax.scatter([B_crit], [0.5], s=36, color=DATA, zorder=3)
ax.annotate("critical batch size",
            xy=(B_crit, 0.5), xytext=(B_crit * 2.2, 0.30),
            color=INK, fontsize=9,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

# Label the two regimes.
ax.text(0.04, 0.86, "linear regime\ncompute well spent",
        color=INK, fontsize=8.5, va="top")
ax.text(30, 0.62, "saturation\ncompute wasted",
        color=INK, fontsize=8.5, ha="right", va="top")

ax.set_xscale("log")
ax.set_xlabel("batch size (units of critical batch size, log scale)", color=INK)
ax.set_ylabel("training progress per step (normalized)", color=INK)
ax.set_ylim(0, 1.02)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

fig.tight_layout()
fig.savefig(
    "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/en/figures/03-scaling-laws-2.svg",
    format="svg", bbox_inches="tight", transparent=True,
)
