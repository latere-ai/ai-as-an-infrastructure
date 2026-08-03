import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Balanced synchronous GPipe flush schedule with equal stage times and
# negligible communication. This is an analytic model, not measured throughput.

fig_color = "#6b7280"
data_color = "#3b82f6"

m = np.arange(1, 129)

fig, ax = plt.subplots(figsize=(5, 3))

for p, ls, alpha in [(4, "-", 1.0), (8, "--", 0.75), (16, ":", 0.55)]:
    frac = (p - 1) / (m + p - 1)
    ax.plot(m, frac, ls, color=data_color, alpha=alpha, label=f"{p} stages")

ax.set_xlabel("micro-batches per step (m)", color=fig_color)
ax.set_ylabel("pipeline bubble fraction", color=fig_color)
ax.set_xlim(1, 128)
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
from common import save_bilingual

save_bilingual(fig, "training-at-scale-1")
