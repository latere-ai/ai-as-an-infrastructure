import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic: how a mixture-of-experts layer decouples capacity from
# per-token compute. A dense layer welds the two together, so total
# parameters and active (per-token) parameters rise as one line. An
# MoE layer holds N experts but routes each token to only k of them,
# so total parameters (capacity) climb with N while active parameters
# (the FLOPs paid per token) stay almost flat. Idealized counts.

GRAY = "#6b7280"
BLUE = "#3b82f6"

N = np.arange(1, 33)             # number of experts in the layer
k = 2                            # experts activated per token

per_expert = 1.0                 # params per expert, arbitrary unit
always_on = 1.0                  # shared / attention params, always active

total = always_on + N * per_expert          # capacity grows with N
active = always_on + k * per_expert          # active stays flat (k fixed)
active = np.full_like(total, active)

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(N, total, color=BLUE, linewidth=2.0,
        label="Total parameters (capacity)")
ax.plot(N, active, color=GRAY, linewidth=2.0, linestyle="--",
        label="Active parameters (per-token FLOPs)")

ax.fill_between(N, active, total, color=BLUE, alpha=0.08)

ax.set_xlabel("Number of experts N (k = 2 active)")
ax.set_ylabel("Parameters")

ax.set_xlim(1, 32)
ax.set_ylim(0, total.max() * 1.05)

ax.annotate("capacity grows\nalmost for free",
            xy=(26, total[25]), xytext=(6, total.max() * 0.72),
            color=GRAY, fontsize=9,
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
ax.set_yticklabels([])

fig.tight_layout()
fig.savefig(
    "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/en/figures/07-moe-ssm-hybrids-2.svg",
    format="svg", bbox_inches="tight", transparent=True,
)
