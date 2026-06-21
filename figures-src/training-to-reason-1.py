import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of the amplification hypothesis from the chapter's "what's
# contested" box: RLVR raises pass@1 by concentrating probability on paths the
# base model can already sample, so the RL-trained curve starts higher but
# saturates early, while the base model's pass@k keeps climbing and can overtake
# it at large k. This is idealized synthetic data, not measured numbers, drawn
# only to show the crossover the text describes.

INK = "#6b7280"
DATA = "#3b82f6"

k = np.logspace(0, 3, 200)  # number of samples, 1 to 1000, log scale

# pass@k of a model whose per-sample success probability is p:
#   pass@k = 1 - (1 - p)^k
# RL model: high per-sample success, but its reachable solution set is narrower,
# so we cap it below 1 to model the early saturation the amplification view
# predicts.
p_rl = 0.42
cap_rl = 0.86
rl = cap_rl * (1.0 - (1.0 - p_rl) ** k)

# Base model: low per-sample success, but broader support, so given enough
# samples it eventually finds a correct path and climbs higher.
p_base = 0.06
cap_base = 0.98
base = cap_base * (1.0 - (1.0 - p_base) ** k)

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(k, rl, color=DATA, lw=1.8, zorder=3, label="RL-trained model")
ax.plot(k, base, color=INK, lw=1.6, ls="--", zorder=2, label="base model")

# Mark the crossover where the base curve overtakes the RL curve.
cross = np.argmin(np.abs(rl - base))
# only treat as crossover once base has risen above rl after starting below
above = np.where((base > rl) & (k > 2))[0]
if len(above):
    ci = above[0]
    ax.scatter([k[ci]], [base[ci]], s=40, facecolors="none",
               edgecolors=INK, linewidths=1.4, zorder=4)
    ax.annotate("base overtakes\nat large k", xy=(k[ci], base[ci]),
                xytext=(k[ci] * 0.10, base[ci] - 0.30),
                color=INK, fontsize=8.5,
                arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xscale("log")
ax.set_xlabel("k, samples per problem (log scale)", color=INK)
ax.set_ylabel("pass@k", color=INK)
ax.set_ylim(0, 1.0)

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

save_bilingual(fig, "training-to-reason-1")
