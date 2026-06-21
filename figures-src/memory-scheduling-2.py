import os
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of the block-size trade-off in paged attention. Two costs pull in
# opposite directions as the block grows. Internal fragmentation is the
# partial final block, which averages about half a block per request, so it
# rises linearly with block size. Indirection overhead is the block-table
# entries and the per-kernel gather through them, which fall as roughly one
# over the block size because a larger block needs fewer entries to cover a
# sequence. Their sum is a U-curve with an interior optimum, which is why the
# block size is a tuning knob rather than a constant. Idealized synthetic
# numbers, not measured data. After Kwon et al. (2023), PagedAttention / vLLM.

INK = "#6b7280"
DATA = "#3b82f6"
FRAG_C = "#9ca3af"   # grayscale components so they read light and dark
OVH_C = "#9ca3af"

# Block size in tokens, the knob.
block = np.linspace(2, 128, 400)

# Internal fragmentation: about half a block wasted per request, normalized
# against a representative sequence length, so cost grows linearly.
seq_len = 512.0
frag = 0.5 * block / seq_len

# Indirection overhead: block-table entries and gather steps scale as the
# number of blocks per sequence, about seq_len / block, with a small per-entry
# cost. Falls as one over the block size.
per_entry = 0.9
overhead = per_entry * (seq_len / block) / seq_len

total = frag + overhead
b_star = block[np.argmin(total)]
t_star = total.min()

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(block, frag, color=FRAG_C, lw=1.4, ls=":",
        label="internal fragmentation (partial block)")
ax.plot(block, overhead, color=OVH_C, lw=1.4, ls="--",
        label="indirection overhead (table + gather)")
ax.plot(block, total, color=DATA, lw=2.0, label="total cost")

# Mark the optimum.
ax.axvline(b_star, color=INK, lw=1.0, alpha=0.5)
ax.plot([b_star], [t_star], "o", color=DATA, ms=5)
ax.annotate("block size that\nminimizes total cost",
            xy=(b_star, t_star), xytext=(b_star + 14, t_star + 0.06),
            color=INK, fontsize=8.5,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xlim(0, 128)
ax.set_ylim(0, max(total[0], total[-1]) * 1.05)
ax.set_xlabel("block size (tokens per block)", color=INK)
ax.set_ylabel("wasted fraction of KV memory", color=INK)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

leg = ax.legend(frameon=False, fontsize=8, loc="upper center")
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "memory-scheduling-2")
