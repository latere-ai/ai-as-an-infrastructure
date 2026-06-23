import matplotlib

matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

from common import DATA, INK, MUTED, WARN, save_bilingual


x = np.logspace(0, 3, 240)
lx = np.log10(x)

# Accuracy rises as useful deliberation catches errors, then declines once
# extra tokens create loops, drift, or selector pressure. Synthetic schematic.
gain = 0.28 + 0.58 * (1.0 - np.exp(-1.4 * lx))
overthink_penalty = 0.055 * np.maximum(lx - 2.0, 0) ** 2.2
accuracy = np.clip(gain - overthink_penalty, 0, 1)
cost = 0.15 + 0.85 * lx / lx.max()

fig, ax = plt.subplots(figsize=(5.4, 3.1))
ax2 = ax.twinx()

ax.axvspan(10, 120, color=DATA, alpha=0.08)
ax.axvspan(180, 1000, color=WARN, alpha=0.10)
ax.plot(x, accuracy, color=DATA, linewidth=2.0, label="accuracy")
ax2.plot(x, cost, color=WARN, linewidth=1.6, linestyle="--", label="cost / latency")

ax.text(27, 0.93, "useful-thinking window", color=INK, fontsize=8.3, ha="center")
ax.text(430, 0.28, "overthinking region", color=INK, fontsize=8.3, ha="center")

ax.set_xscale("log")
ax.set_xlabel("reasoning tokens", color=INK)
ax.set_ylabel("accuracy", color=INK)
ax2.set_ylabel("cost / latency", color=INK)
ax.set_ylim(0, 1.02)
ax2.set_ylim(0, 1.02)

for side in ("top",):
    ax.spines[side].set_visible(False)
    ax2.spines[side].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax2.spines["right"].set_color(INK)
ax.tick_params(colors=INK, which="both")
ax2.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels() + ax2.get_yticklabels():
    lbl.set_color(INK)

fig.tight_layout()
save_bilingual(fig, "inference-time-scaling-3")
