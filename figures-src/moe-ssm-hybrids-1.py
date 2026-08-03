import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Growth of the dominant sequence-length term under fixed model dimensions.
# Both curves are normalized at a 1,000-token context. They are asymptotic
# accounting, not measured FLOPs or runtime.

GRAY = "#6b7280"
BLUE = "#3b82f6"

context_thousands = np.geomspace(1, 128, 400)
attention_growth = context_thousands ** 2
recurrent_growth = context_thousands

fig, ax = plt.subplots(figsize=(5.2, 3.1))

ax.loglog(context_thousands, attention_growth, color=BLUE, linewidth=2.0,
          label="Attention relationships (quadratic)")
ax.loglog(context_thousands, recurrent_growth, color=GRAY, linewidth=2.0,
          linestyle="--", label="Recurrent updates (linear)")

ax.set_xlabel("Context length (thousands of tokens)")
ax.set_ylabel("Growth relative to 1K tokens")
ax.set_xlim(1, 128)
ax.set_ylim(1, attention_growth.max() * 1.15)
ax.set_xticks([1, 2, 4, 8, 16, 32, 64, 128])
ax.set_xticklabels(["1", "2", "4", "8", "16", "32", "64", "128"])
ax.grid(True, which="major", color="#d1d5db", linewidth=0.5, alpha=0.5)
ax.legend(frameon=False, loc="upper left", fontsize=8,
          labelcolor=GRAY)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(GRAY)

ax.tick_params(colors=GRAY)
ax.xaxis.label.set_color(GRAY)
ax.yaxis.label.set_color(GRAY)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "moe-ssm-hybrids-1")
