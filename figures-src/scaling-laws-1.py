import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic power-law extrapolation: loss falls as a power law in compute,
# so a few cheap small-scale runs fit a straight line on log-log axes and
# predict the loss of a large run you can only afford to do once.
# This is idealized synthetic data, not measured numbers.

INK = "#6b7280"
DATA = "#3b82f6"

# Idealized power law L(C) = E + A * C^(-alpha), plotted as the reducible
# part above the irreducible floor E so the log-log relationship is a line.
E = 1.6          # irreducible loss floor
A = 30.0         # scale constant
alpha = 0.05     # power-law exponent (gentle, as real fits are)

compute = np.logspace(0, 8, 200)           # arbitrary compute units (FLOPs)
loss_reducible = A * compute ** (-alpha)    # the part that scales

# A ladder of cheap small runs we can actually afford.
cheap_C = np.array([3e0, 1e1, 4e1, 1.5e2, 6e2, 2.5e3])
cheap_L = A * cheap_C ** (-alpha)
rng = np.random.default_rng(7)
cheap_L = cheap_L * (1.0 + rng.normal(0, 0.012, size=cheap_C.shape))  # tiny scatter

# The one large run we forecast by extrapolation.
big_C = 5e7
big_L = A * big_C ** (-alpha)

fig, ax = plt.subplots(figsize=(5, 3))

# The fitted / extrapolated power law.
ax.plot(compute, loss_reducible, color=DATA, lw=1.8, zorder=2)

# Cheap measured runs.
ax.scatter(cheap_C, cheap_L, s=28, color=DATA, zorder=3,
           label="cheap small runs (fit)")

# Forecast point for the expensive run.
ax.scatter([big_C], [big_L], s=70, facecolors="none", edgecolors=DATA,
           linewidths=1.8, zorder=3, label="forecast large run")

# Annotate the affordable region vs the extrapolation.
ax.axvspan(compute.min(), cheap_C.max(), color=INK, alpha=0.06, zorder=0)
ax.annotate("extrapolate", xy=(big_C, big_L),
            xytext=(big_C / 600, big_L * 1.55),
            color=INK, fontsize=9,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))
ax.text(cheap_C.max() * 0.18, loss_reducible.min() * 1.05, "affordable",
        color=INK, fontsize=9, ha="center")

ax.set_xscale("log")
ax.set_yscale("log")
ax.set_xlabel("training compute (FLOPs, log scale)", color=INK)
ax.set_ylabel("reducible loss above floor (log scale)", color=INK)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

leg = ax.legend(frameon=False, fontsize=8, loc="upper right")
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "scaling-laws-1")
