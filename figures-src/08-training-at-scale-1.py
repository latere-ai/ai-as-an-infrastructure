import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np
import os

# Schematic: pipeline bubble fraction shrinks with more micro-batches.
# Idealized model: bubble fraction = (p - 1) / (m + p - 1) for p stages
# and m micro-batches. Synthetic, illustrative only; not measured data.

fig_color = "#6b7280"
data_color = "#3b82f6"

m = np.linspace(1, 64, 400)

fig, ax = plt.subplots(figsize=(5, 3))

for p, ls, alpha in [(4, "-", 1.0), (8, "--", 0.75), (16, ":", 0.55)]:
    frac = (p - 1) / (m + p - 1)
    ax.plot(m, frac, ls, color=data_color, alpha=alpha, label=f"{p} stages")

ax.set_xlabel("micro-batches per step (m)", color=fig_color)
ax.set_ylabel("pipeline bubble fraction", color=fig_color)
ax.set_xlim(1, 64)
ax.set_ylim(0, 1)

ax.tick_params(colors=fig_color)
for spine in ax.spines.values():
    spine.set_color(fig_color)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)

leg = ax.legend(frameon=False, labelcolor=fig_color)
for txt in leg.get_texts():
    txt.set_color(fig_color)

fig.tight_layout()

path = "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/en/figures/08-training-at-scale-1.svg"
os.makedirs(os.path.dirname(path), exist_ok=True)
fig.savefig(path, format="svg", bbox_inches="tight", transparent=True)
