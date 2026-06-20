import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np
import os

# Schematic: model FLOPs utilization (MFU) as the tensor-parallel degree grows.
# Idealized model, not measured data. TP exchanges activations with two
# all-reduces per layer; that comm time per layer scales as ~1/bandwidth.
# Inside the NVLink domain (here 8 devices) bandwidth is high, so the
# all-reduce hides under compute and MFU sits near its plateau. Push TP past
# the node and the all-reduce falls onto the inter-node network, ~10x slower
# per byte, so exposed communication spikes and MFU falls off a cliff.
#   MFU = compute / (compute + exposed_comm),  exposed_comm proportional to 1/BW
# Synthetic, illustrative only; after Shoeybi et al. (2019), Narayanan et al. (2021).

fig_color = "#6b7280"
data_color = "#3b82f6"

nvlink_domain = 8           # devices reachable at NVLink-class bandwidth
tp = np.arange(1, 33)       # tensor-parallel degree

# Per-device compute work falls as 1/tp (the matmul is sharded).
compute = 1.0 / tp
# All-reduce volume per layer grows with tp; cost also scales as 1/bandwidth.
# Bandwidth is high inside the NVLink domain, ~10x lower once TP spills out.
bandwidth = np.where(tp <= nvlink_domain, 1.0, 0.1)
exposed_comm = (tp / bandwidth) * 0.0012

mfu = compute / (compute + exposed_comm)
mfu = mfu / mfu.max()       # normalize the plateau to 1.0 for a clean schematic

fig, ax = plt.subplots(figsize=(5, 3))

inside = tp <= nvlink_domain
ax.plot(tp[inside], mfu[inside], "-", color=data_color, label="within NVLink domain")
# bridge the cliff so the line stays continuous across the boundary
ax.plot(tp[tp >= nvlink_domain], mfu[tp >= nvlink_domain], "--", color=data_color,
        alpha=0.7, label="spilled onto inter-node network")

ax.axvline(nvlink_domain, color=fig_color, lw=0.9, ls=":", alpha=0.7)
ax.annotate("NVLink boundary", xy=(nvlink_domain, 0.45),
            xytext=(nvlink_domain + 1.5, 0.6), color=fig_color, fontsize=9)

ax.set_xlabel("tensor-parallel degree", color=fig_color)
ax.set_ylabel("model FLOPs utilization (normalized)", color=fig_color)
ax.set_xlim(1, 32)
ax.set_ylim(0, 1.05)

ax.tick_params(colors=fig_color)
for spine in ax.spines.values():
    spine.set_color(fig_color)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)

leg = ax.legend(frameon=False, labelcolor=fig_color, fontsize=9, loc="lower left")
for txt in leg.get_texts():
    txt.set_color(fig_color)

fig.tight_layout()

path = "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/en/figures/30-accelerators-networking-1.svg"
os.makedirs(os.path.dirname(path), exist_ok=True)
fig.savefig(path, format="svg", bbox_inches="tight", transparent=True)
