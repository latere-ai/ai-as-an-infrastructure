import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FixedLocator, FuncFormatter, NullFormatter
import numpy as np

# Exact parameter accounting for one bias-free SwiGLU MoE layer:
#   model width 4096, expert width 14336, and top-2 routing.
# Stored parameters include every expert and the router. Evaluated parameters
# include two experts and the router scores for every expert. Attention and
# other always-on weights are deliberately excluded.
#
# The y axis is logarithmic and the router term E*d is drawn on its own: it is
# the only part of the evaluated count that grows with E, and on a linear axis
# it is too small to see against two experts.

GRAY = "#6b7280"
BLUE = "#3b82f6"
TEAL = "#14b8a6"

model_width = 4096
expert_width = 14_336
selected_experts = 2
experts = np.arange(selected_experts, 65)

per_expert = 3 * model_width * expert_width
router = experts * model_width
stored = experts * per_expert + router
evaluated = selected_experts * per_expert + router

fig, ax = plt.subplots(figsize=(5.2, 3.1))

ax.semilogy(experts, stored, color=BLUE, linewidth=2.0,
            label="Stored parameters")
ax.semilogy(experts, evaluated, color=GRAY, linewidth=2.0,
            linestyle="--", label="Parameters evaluated per token")
ax.semilogy(experts, router, color=TEAL, linewidth=2.0,
            linestyle=":", label="Router term E·d, inside both counts")

ax.set_xlabel("Routed experts E (k = 2 selected)")
ax.set_ylabel("Parameters in one MoE layer")
ax.set_xlim(selected_experts, experts[-1])
ax.set_ylim(3e3, 3e10)

ticks = [1e4, 1e5, 1e6, 1e7, 1e8, 1e9, 1e10]
names = {1e4: "10K", 1e5: "100K", 1e6: "1M", 1e7: "10M", 1e8: "100M",
         1e9: "1B", 1e10: "10B"}
ax.yaxis.set_major_locator(FixedLocator(ticks))
ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: names.get(v, "")))
ax.yaxis.set_minor_formatter(NullFormatter())
ax.grid(True, which="major", axis="y", color="#d1d5db", linewidth=0.5,
        alpha=0.5)
ax.legend(frameon=False, loc="center right", fontsize=8,
          labelcolor=GRAY)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(GRAY)

ax.tick_params(colors=GRAY, which="both")
ax.xaxis.label.set_color(GRAY)
ax.yaxis.label.set_color(GRAY)

fig.tight_layout()
from common import ZH_TEXT, save_bilingual

# Labels this figure adds beyond the shared table.
ZH_TEXT.update({
    "Router term E·d, inside both counts": "路由项 E·d，两者都包含",
    "Parameters in one MoE layer": "单个 MoE 层参数量",
})

save_bilingual(fig, "moe-ssm-hybrids-2")
