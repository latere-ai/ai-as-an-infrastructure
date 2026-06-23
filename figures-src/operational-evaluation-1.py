import matplotlib

matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

from common import DATA, ACCENT, WARN, INK, save_bilingual

# Schematic: operational evaluation treats model choice as a frontier over
# quality, latency, and cost. Points below the frontier are dominated even if
# one of their raw benchmark scores looks attractive.

names = ["small", "routed", "frontier", "slow giant", "cheap weak"]
cost = np.array([0.25, 0.55, 1.3, 2.2, 0.12])
quality = np.array([0.68, 0.79, 0.86, 0.865, 0.55])
latency = np.array([0.18, 0.32, 0.72, 1.15, 0.12])
sizes = 220 * (0.35 + latency)

fig, ax = plt.subplots(figsize=(5.1, 3.1))
colors = [DATA, ACCENT, WARN, "#9ca3af", "#9ca3af"]
ax.scatter(cost, quality * 100, s=sizes, color=colors, alpha=0.86, edgecolor="white", linewidth=0.8)
frontier = [0, 1, 2]
ax.plot(cost[frontier], quality[frontier] * 100, color=ACCENT, lw=1.6)
for i, name in enumerate(names):
    dx = 0.04 if i != 3 else -0.08
    ha = "left" if i != 3 else "right"
    ax.text(cost[i] + dx, quality[i] * 100 + 0.6, name, fontsize=8.5, color=INK, ha=ha)
ax.annotate(
    "dominated: more cost\nwithout useful quality",
    xy=(2.2, 86.5),
    xytext=(1.48, 80.5),
    fontsize=8.5,
    color=INK,
    arrowprops=dict(arrowstyle="->", color=INK, lw=0.9),
)
ax.text(0.14, 88.0, "bubble size = latency", fontsize=8.5, color=INK)
ax.set_xlabel("relative cost per task")
ax.set_ylabel("task quality")
ax.set_xlim(0, 2.55)
ax.set_ylim(52, 90)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK)
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)
fig.tight_layout()
save_bilingual(fig, "operational-evaluation-1")

