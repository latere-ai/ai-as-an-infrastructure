import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic large-batch tradeoff: progress per optimizer step rises almost
# linearly with batch size at first, then saturates. Larger batches beyond the
# knee can still reduce the number of sequential steps, but with diminishing
# compute efficiency. This is idealized synthetic data.

INK = "#6b7280"
DATA = "#3b82f6"

# McCandlish et al.'s empirical model gives a hyperbolic tradeoff. In normalized
# units, progress per optimizer step is B / (B + B_noise), where B_noise is the
# gradient noise scale and locates the knee.
B_noise = 1.0
B = np.logspace(-2, 2.3, 300)             # batch size in units of B_noise
progress = B / (B + B_noise)              # normalized progress per step (0..1)

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(B, progress, color=DATA, lw=1.8, zorder=2)

# Mark the noise-scale knee where returns start to bend over (B = B_noise,
# speedup = 0.5 of the asymptote).
ax.axvline(B_noise, color=INK, lw=1.0, ls="--", alpha=0.55, zorder=1)
ax.scatter([B_noise], [0.5], s=36, color=DATA, zorder=3)
ax.annotate("noise-scale knee",
            xy=(B_noise, 0.5), xytext=(B_noise * 2.2, 0.30),
            color=INK, fontsize=9,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

# Label the two regimes.
ax.text(0.04, 0.86, "near-linear regime\nstep savings scale well",
        color=INK, fontsize=8.5, va="top")
ax.text(30, 0.68, "diminishing returns\nfewer steps, lower efficiency",
        color=INK, fontsize=8.5, ha="right", va="top")

ax.set_xscale("log")
ax.set_xlabel("batch size (units of noise scale, log scale)", color=INK)
ax.set_ylabel("progress per optimizer step (normalized)", color=INK)
ax.set_ylim(0, 1.02)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "scaling-laws-2")
