import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np
from matplotlib.ticker import FixedLocator, FixedFormatter, NullLocator

# Exact byte counts for two named tensors. The linear line is one BF16
# token-state tensor, not a model of FlashAttention's total peak memory. The
# dotted line is 80 GB (80e9 bytes), the HBM capacity of an 80 GB accelerator
# such as the NVIDIA H100 SXM (datasheet value), so the reader can see the
# context length at which the score tensor alone no longer fits one device.

fig_color = "#6b7280"
data_color = "#3b82f6"

batch = 1
heads = 32
hidden = 4096
bytes_per_element = 2
hbm_bytes = 80e9
L = np.geomspace(1024, 131072, 400)

scores = batch * heads * L**2 * bytes_per_element
token_state = batch * L * hidden * bytes_per_element

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(L, scores, "-", color=data_color, label="materialized scores (B×H×L²)")
ax.plot(L, token_state, "--", color=fig_color, label="one token-state tensor (B×L×d)")
ax.axhline(hbm_bytes, color=fig_color, linestyle=":", linewidth=1)
ax.text(124000, hbm_bytes / 1.4, "80 GB HBM", color=fig_color, fontsize=8, ha="right", va="top")

ax.set_xlabel("context length L (tokens)", color=fig_color)
ax.set_ylabel("tensor size", color=fig_color)
ax.set_xscale("log", base=2)
ax.set_yscale("log", base=2)
ax.set_xlim(1024, 131072)
ax.set_ylim(2**22, 2**42)

x_ticks = [2**k for k in range(10, 18)]
ax.xaxis.set_major_locator(FixedLocator(x_ticks))
ax.xaxis.set_major_formatter(FixedFormatter([f"{t // 1024}K" for t in x_ticks]))
ax.xaxis.set_minor_locator(NullLocator())
y_ticks = [2**24, 2**28, 2**32, 2**36, 2**40]
ax.yaxis.set_major_locator(FixedLocator(y_ticks))
ax.yaxis.set_major_formatter(FixedFormatter(["16 MiB", "256 MiB", "4 GiB", "64 GiB", "1 TiB"]))
ax.yaxis.set_minor_locator(NullLocator())

ax.tick_params(colors=fig_color)
for spine in ax.spines.values():
    spine.set_color(fig_color)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)

leg = ax.legend(frameon=False, labelcolor=fig_color, loc="upper left", fontsize=8)
for txt in leg.get_texts():
    txt.set_color(fig_color)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "training-at-scale-2")
