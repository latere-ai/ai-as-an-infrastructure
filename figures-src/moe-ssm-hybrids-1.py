import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic: the cost of sequence mixing as context length grows.
# Attention mixes every token with every other, so its per-step cost
# (and the KV-cache it leaves behind) grows with the square of the
# sequence length. A state-space recurrence keeps a fixed-size state
# and updates it token by token, so its cost grows only linearly.
# Idealized curves, normalized so both start at the same unit cost.

GRAY = "#6b7280"
BLUE = "#3b82f6"

L = np.linspace(1.0, 8.0, 400)   # sequence length in arbitrary units

attention = L ** 2               # quadratic mixing cost
ssm = L                          # linear recurrence cost

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(L, attention, color=BLUE, linewidth=2.0,
        label="Attention (quadratic)")
ax.plot(L, ssm, color=GRAY, linewidth=2.0, linestyle="--",
        label="State-space (linear)")

ax.set_xlabel("Sequence length")
ax.set_ylabel("Sequence-mixing cost")

ax.set_xlim(1.0, 8.0)
ax.set_ylim(0, attention.max() * 1.05)

# annotate the widening gap toward the long-context end.
# keep the text low-right so it clears the upper-left legend; the
# longer zh wording needs the extra room.
ax.annotate("widening gap\nat long context",
            xy=(7.0, 7.0 ** 2), xytext=(4.2, 12),
            ha="left", color=GRAY, fontsize=9,
            arrowprops=dict(arrowstyle="->", color=GRAY, lw=1.0))

ax.legend(frameon=False, loc="upper left", fontsize=9,
          labelcolor=GRAY)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(GRAY)

ax.tick_params(colors=GRAY)
ax.xaxis.label.set_color(GRAY)
ax.yaxis.label.set_color(GRAY)
# unitless schematic: hide numeric tick labels, keep the shape
ax.set_xticklabels([])
ax.set_yticklabels([])

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "moe-ssm-hybrids-1")
