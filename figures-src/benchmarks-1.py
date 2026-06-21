import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic benchmark saturation. As successive model generations improve,
# scores on a fixed benchmark climb toward a ceiling. Once the frontier
# clusters near the top, the remaining headroom is noise and the benchmark
# stops separating systems. A harder successor benchmark restores spread but
# follows the same fate. This is idealized synthetic data, not measured scores.

INK = "#6b7280"
DATA = "#3b82f6"

CEIL = 100.0  # benchmark ceiling (percent)

# Model generations along the x axis (arbitrary release order).
gen = np.linspace(0, 9, 200)

# A saturating curve approaching the ceiling for the original benchmark.
easy = CEIL * (1.0 - np.exp(-0.55 * gen)) + 5.0
easy = np.clip(easy, 0, CEIL - 1)

# A harder successor benchmark introduced once the first saturates: it starts
# low again at later generations, restoring discrimination for a while.
hard_gen = np.linspace(4.5, 9, 120)
hard = CEIL * (1.0 - np.exp(-0.5 * (hard_gen - 4.5))) + 12.0
hard = np.clip(hard, 0, CEIL - 1)

fig, ax = plt.subplots(figsize=(5, 3))

# Ceiling line.
ax.axhline(CEIL, color=INK, lw=1.0, ls="--", alpha=0.7)
ax.text(0.1, CEIL - 4, "ceiling", color=INK, fontsize=9, va="top")

# The saturating original benchmark.
ax.plot(gen, easy, color=DATA, lw=1.8, label="original benchmark")

# The harder successor.
ax.plot(hard_gen, hard, color=INK, lw=1.8, ls="-", alpha=0.9,
        label="harder successor")

# Shade the saturated zone where headroom is noise.
sat_mask = easy > CEIL - 8
ax.fill_between(gen, easy, CEIL, where=sat_mask, color=INK, alpha=0.08,
                zorder=0)
# Annotate the collapse of discrimination.
ax.annotate("headroom is noise:\nsystems no longer separable",
            xy=(8.0, CEIL - 2.5), xytext=(3.4, CEIL - 33),
            color=INK, fontsize=8.5,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xlim(0, 9)
ax.set_ylim(0, CEIL + 6)
ax.set_xlabel("successive model generations", color=INK)
ax.set_ylabel("benchmark score (%)", color=INK)

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

save_bilingual(fig, "benchmarks-1")
