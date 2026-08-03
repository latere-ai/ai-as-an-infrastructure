import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Exact storage implied by token-indexed parameter matrices under the stated
# assumptions. This deliberately does not invent a sequence-length curve or a
# universal optimum: those depend on the corpus, model, and workload.

GRAY = "#6b7280"
BLUE = "#3b82f6"

vocab = np.linspace(8_000, 256_000, 200)
width = 4_096
bytes_per_parameter = 2
tied_gib = vocab * width * bytes_per_parameter / 2**30
untied_gib = 2 * tied_gib

fig, ax = plt.subplots(figsize=(5, 3))

ax.plot(vocab, tied_gib, color=BLUE, linewidth=2.0,
        label="tied input / output weights")
ax.plot(vocab, untied_gib, color=GRAY, linewidth=2.0, linestyle="--",
        label="untied input + output weights")
ax.set_xlabel("vocabulary size (tokens)", color=GRAY)
ax.set_ylabel("token-indexed parameter storage (GiB)", color=GRAY)
ax.tick_params(axis="both", colors=GRAY)
ax.ticklabel_format(axis="x", style="plain")
for spine in ax.spines.values():
    spine.set_color(GRAY)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)
ax.legend(loc="upper left", frameon=False, labelcolor=GRAY, fontsize=8)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "tokenization-1")
