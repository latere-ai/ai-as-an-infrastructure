import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np
import os

# Schematic: peak attention memory vs sequence length. A materialized score
# matrix grows as O(L^2); an IO-aware kernel that never writes the scores to
# HBM grows as O(L). Synthetic, idealized arbitrary units; not measured data.

fig_color = "#6b7280"
data_color = "#3b82f6"

L = np.linspace(0, 32, 400)  # sequence length, arbitrary units (e.g. K tokens)

# Arbitrary-unit memory curves: quadratic score matrix vs linear streaming.
naive = (L / 32.0) ** 2          # normalized O(L^2)
flash = (L / 32.0) * 0.18        # O(L), small constant

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(L, naive, "-", color=data_color, label="materialized scores  O(L²)")
ax.plot(L, flash, "--", color=fig_color, label="IO-aware kernel  O(L)")

ax.set_xlabel("sequence length L (arbitrary units)", color=fig_color)
ax.set_ylabel("peak attention memory (arbitrary units)", color=fig_color)
ax.set_xlim(0, 32)
ax.set_ylim(0, 1.05)

ax.tick_params(colors=fig_color)
for spine in ax.spines.values():
    spine.set_color(fig_color)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)

leg = ax.legend(frameon=False, labelcolor=fig_color, loc="upper left")
for txt in leg.get_texts():
    txt.set_color(fig_color)

fig.tight_layout()

path = "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/en/figures/08-training-at-scale-2.svg"
os.makedirs(os.path.dirname(path), exist_ok=True)
fig.savefig(path, format="svg", bbox_inches="tight", transparent=True)
