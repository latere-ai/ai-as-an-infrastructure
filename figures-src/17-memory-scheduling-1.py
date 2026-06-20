import os
import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of why paging lifts the achievable batch size. A request whose
# final length is unknown forces a choice. Reserve a contiguous max-length
# buffer up front, and the memory actually used is only the realized length,
# so utilization is the ratio of mean to maximum length and the dead tail
# grows as that ratio falls (short requests inside a max-length reservation).
# Paged allocation grows block by block, so the only waste is the partial
# final block and utilization stays near full regardless of length spread.
# Utilization is what sets the achievable batch size: the same pool holds
# more requests when less of it is dead reservation. Idealized synthetic
# numbers, not measured data. After Kwon et al. (2023), PagedAttention / vLLM.

INK = "#6b7280"
DATA = "#3b82f6"
PAGED = "#9ca3af"   # grayscale second series so it reads light and dark

# x axis: how short the average request is relative to the longest one it
# might become. 1.0 means every request runs to the reserved maximum.
ratio = np.linspace(0.05, 1.0, 400)

# Reserve-max: a request occupies a full max-length buffer but only fills the
# realized fraction, so the fraction of the pool actually in use equals the
# mean-to-max length ratio. Utilization falls as that ratio falls.
reserve_max = ratio

# Paged: per-request memory is the realized length plus at most one partial
# final block, so utilization stays near full and is nearly flat in the ratio.
# Model the partial-block tail as a small fixed fraction of realized memory.
partial_block_overhead = 0.06
paged = 1.0 / (1.0 + partial_block_overhead) * np.ones_like(ratio)

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(ratio, paged, color=PAGED, lw=1.8, ls="--",
        label="paged (block by block)")
ax.plot(ratio, reserve_max, color=DATA, lw=1.8,
        label="reserve max length")

# Shade the gap the second move reclaims at a representative length spread.
r0 = 0.3
rm0 = r0
pg0 = 1.0 / (1.0 + partial_block_overhead)
ax.annotate("reclaimed utilization,\nand thus higher batch size",
            xy=(r0, (rm0 + pg0) / 2.0), xytext=(0.40, 0.30),
            color=INK, fontsize=8.5,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))
ax.plot([r0, r0], [rm0, pg0], color=INK, lw=1.0, alpha=0.5)

ax.set_xlim(0, 1.0)
ax.set_ylim(0, 1.05)
ax.set_xlabel("mean / max request length (length spread)", color=INK)
ax.set_ylabel("KV memory utilization (fraction of pool in use)", color=INK)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

leg = ax.legend(frameon=False, fontsize=8, loc="upper left")
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
ROOT = "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure"
for lang in ("en", "zh"):
    out_dir = os.path.join(ROOT, lang, "figures")
    os.makedirs(out_dir, exist_ok=True)
    fig.savefig(
        os.path.join(out_dir, "17-memory-scheduling-1.svg"),
        format="svg", bbox_inches="tight", transparent=True,
    )
