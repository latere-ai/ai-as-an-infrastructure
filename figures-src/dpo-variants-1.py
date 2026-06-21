import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic shape of two preference-optimization losses as a function of the
# implicit reward gap (chosen minus rejected). The DPO log-sigmoid loss keeps
# decreasing as the gap grows, so on clean, near-deterministic data the optimum
# pushes the gap toward infinity. The IPO squared loss is bounded with a minimum
# at a fixed positive target, so the optimum stays finite. These are the loss
# functions themselves, evaluated on idealized inputs, not measured data.

INK = "#6b7280"
DATA = "#3b82f6"

# Implicit reward gap = beta * (log-ratio_chosen - log-ratio_rejected).
gap = np.linspace(-2.0, 8.0, 400)

# DPO: -log sigmoid(gap). Monotonically decreasing toward zero, never flat.
dpo = -np.log(1.0 / (1.0 + np.exp(-gap)))

# IPO: (gap - tau)^2, bounded parabola with minimum at a fixed target tau.
tau = 3.0
ipo = (gap - tau) ** 2

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(gap, dpo, color=DATA, lw=1.8, linestyle="-",
        label="DPO log-sigmoid (unbounded pull)")
ax.plot(gap, ipo, color=INK, lw=1.8, linestyle="--",
        label="IPO squared loss (target at $\\tau$)")

# Mark the IPO target: the gap the bounded loss settles on.
ax.axvline(tau, color=INK, lw=0.9, alpha=0.4)
ax.annotate("IPO optimum\nstays finite", xy=(tau, 0.0),
            xytext=(3.4, 3.4), color=INK, fontsize=8,
            ha="left", arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))
ax.annotate("DPO keeps\npushing the gap", xy=(7.0, dpo[np.argmin(np.abs(gap - 7.0))]),
            xytext=(5.2, 1.3), color=INK, fontsize=8,
            ha="left", arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_ylim(-0.3, 8.0)
ax.set_xlabel("implicit reward gap (chosen minus rejected)", color=INK)
ax.set_ylabel("per-example loss", color=INK)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

leg = ax.legend(frameon=False, fontsize=8, loc="upper center",
                bbox_to_anchor=(0.5, 1.18), ncol=1)
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "dpo-variants-1")
