import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic: why a held-out set must be large enough. The 95% confidence
# interval on an accuracy estimate shrinks as 1/sqrt(n) with the number of
# held-out examples. A small set produces a fragile number whose error bar
# can swamp the gap between two systems, which is how noise masquerades as
# signal. This is idealized synthetic data, not measured results.

INK = "#6b7280"
DATA = "#3b82f6"

# Held-out set size on a log axis.
n = np.logspace(1, 4, 200)  # 10 to 10,000 examples

# Binomial standard error at an illustrative accuracy p, times 1.96 for 95%.
p = 0.7
half_width = 1.96 * np.sqrt(p * (1 - p) / n) * 100.0  # in percentage points

fig, ax = plt.subplots(figsize=(5, 3))

# The shrinking confidence half-width.
ax.plot(n, half_width, color=DATA, lw=1.8)

# Mark an illustrative true gap between two systems that must clear the noise.
gap = 2.0  # percentage points
ax.axhline(gap, color=INK, lw=1.0, ls="--", alpha=0.7)
ax.text(11, gap + 0.5, "true gap between two systems",
        color=INK, fontsize=8.5, va="bottom")

# The crossover where the error bar finally drops below the gap.
n_cross = (1.96 ** 2) * p * (1 - p) / ((gap / 100.0) ** 2)
ax.scatter([n_cross], [gap], s=45, facecolors="none", edgecolors=DATA,
           linewidths=1.8, zorder=3)
ax.annotate("below here the gap\nis swamped by noise",
            xy=(n_cross, gap), xytext=(n_cross * 1.4, gap + 6),
            color=INK, fontsize=8.5,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

# Shade the too-small region.
ax.axvspan(n.min(), n_cross, color=INK, alpha=0.07, zorder=0)

ax.set_xscale("log")
ax.set_xlim(n.min(), n.max())
ax.set_ylim(0, half_width.max() * 1.05)
ax.set_xlabel("held-out set size (examples, log scale)", color=INK)
ax.set_ylabel("95% confidence half-width (pp)", color=INK)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "benchmarks-2")
