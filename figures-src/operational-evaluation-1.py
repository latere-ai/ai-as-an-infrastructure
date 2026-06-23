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
# Offset each label clear of its bubble. The bubble radius scales with sqrt of
# the marker area (s), so larger bubbles need a larger horizontal gap; convert
# the radius from points to data units via the axis scale so labels never sit
# on top of their own dot.
label_offsets = {
    # name: (dx_extra, dy, ha)
    "small": (0.0, 0.0, "left"),
    "routed": (0.0, 0.0, "left"),
    "frontier": (0.0, 0.0, "left"),
    "slow giant": (0.0, 0.0, "right"),
    "cheap weak": (0.0, 0.0, "left"),
}
fig.canvas.draw()
x_per_pt = (ax.get_xlim()[1] - ax.get_xlim()[0]) / (ax.get_window_extent().width)
for i, name in enumerate(names):
    radius_pt = np.sqrt(sizes[i] / np.pi)
    gap = radius_pt * x_per_pt + 0.03
    dx_extra, dy, ha = label_offsets[name]
    dx = (gap if ha == "left" else -gap) + dx_extra
    ax.text(cost[i] + dx, quality[i] * 100 + dy, name, fontsize=8.5, color=INK, ha=ha, va="center")
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

