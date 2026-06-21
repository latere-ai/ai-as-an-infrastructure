import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np
import os

# Schematic: the fraction of a collective that hides under compute, as a
# function of the compute-to-communication ratio. Idealized, not measured data.
# A collective can be overlapped with compute up to the point where compute
# runs out: if a step does T_compute of arithmetic and T_comm of communication,
# the exposed (un-hidden) communication is max(0, T_comm - T_compute), so the
# hidden fraction is min(1, T_compute / T_comm). Plotting against the ratio
# r = T_compute / T_comm gives a curve that rises and saturates at full overlap.
# The NVLink tier sits at high r (comm cheap, fully hidden); the inter-node
# network sits at low r (comm ~10x dearer per byte, so some stays exposed).
# Synthetic, illustrative only; after Shoeybi et al. (2019), Narayanan et al. (2021).

fig_color = "#6b7280"
data_color = "#3b82f6"

r = np.linspace(0.05, 4.0, 400)        # compute-to-communication ratio
hidden = np.minimum(1.0, r)            # fraction of the collective hidden under compute

fig, ax = plt.subplots(figsize=(5.2, 3.6))

ax.plot(r, hidden, "-", color=data_color)
ax.axhline(1.0, color=fig_color, lw=0.8, ls=":", alpha=0.5)

# Mark the two tiers on the curve.
r_net, r_nv = 0.4, 2.6
for rv, lbl, dx in [(r_net, "inter-node network", 0.12), (r_nv, "NVLink tier", -0.1)]:
    hv = min(1.0, rv)
    ax.plot([rv], [hv], "o", color=data_color, ms=5)
    ax.annotate(lbl, xy=(rv, hv), xytext=(rv + dx, hv - 0.18),
                color=fig_color, fontsize=9,
                arrowprops=dict(arrowstyle="-", color=fig_color, lw=0.7))

ax.set_xlabel("compute-to-communication ratio per step", color=fig_color)
ax.set_ylabel("fraction of collective hidden under compute", color=fig_color)
ax.set_xlim(0, 4)
ax.set_ylim(0, 1.1)

ax.tick_params(colors=fig_color)
for spine in ax.spines.values():
    spine.set_color(fig_color)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "accelerators-networking-2")
