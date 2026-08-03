import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Exact byte counts for two named tensors. The linear line is one BF16
# token-state tensor, not a model of FlashAttention's total peak memory.

fig_color = "#6b7280"
data_color = "#3b82f6"

batch = 1
heads = 32
hidden = 4096
bytes_per_element = 2
L = np.geomspace(1024, 131072, 400)
gib = 2**30

scores = batch * heads * L**2 * bytes_per_element / gib
token_state = batch * L * hidden * bytes_per_element / gib

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(L / 1024, scores, "-", color=data_color, label="materialized scores (B×H×L²)")
ax.plot(L / 1024, token_state, "--", color=fig_color, label="one token-state tensor (B×L×d)")

ax.set_xlabel("context length L (thousands of tokens)", color=fig_color)
ax.set_ylabel("tensor size (GiB)", color=fig_color)
ax.set_xscale("log", base=2)
ax.set_yscale("log", base=2)
ax.set_xlim(1, 128)
ax.set_ylim(2**-8, 2**11)

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
