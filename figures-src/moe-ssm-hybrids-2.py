import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Exact parameter accounting for one bias-free SwiGLU MoE layer:
#   model width 4096, expert width 14336, and top-2 routing.
# Stored parameters include every expert and the router. Evaluated parameters
# include two experts and the router scores for every expert. Attention and
# other always-on weights are deliberately excluded.

GRAY = "#6b7280"
BLUE = "#3b82f6"

model_width = 4096
expert_width = 14_336
selected_experts = 2
experts = np.arange(selected_experts, 65)

per_expert = 3 * model_width * expert_width
router = experts * model_width
stored = experts * per_expert + router
evaluated = selected_experts * per_expert + router

fig, ax = plt.subplots(figsize=(5.2, 3.1))

ax.plot(experts, stored / 1e9, color=BLUE, linewidth=2.0,
        label="Stored parameters")
ax.plot(experts, evaluated / 1e9, color=GRAY, linewidth=2.0,
        linestyle="--", label="Parameters evaluated per token")

ax.set_xlabel("Routed experts E (k = 2 selected)")
ax.set_ylabel("Parameters in one MoE layer (billions)")
ax.set_xlim(selected_experts, experts[-1])
ax.set_ylim(0, stored.max() / 1e9 * 1.05)
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

save_bilingual(fig, "moe-ssm-hybrids-2")
