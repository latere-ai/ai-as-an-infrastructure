import os

import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic illustration of the vocabulary-size trade-off.
# Larger vocabularies shorten token sequences (cheaper per document) but
# enlarge the embedding and output matrices (more parameters, rarer tokens
# starved of occurrences). The two effects pull in opposite directions, so
# the optimum is a knee, not an endpoint. Idealized synthetic data only.

GRAY = "#6b7280"
BLUE = "#3b82f6"

# Vocabulary size on a log-spaced axis from 1k to 256k.
vocab = np.logspace(np.log10(1_000), np.log10(256_000), 200)

# Sequence length per document falls with diminishing returns as more
# common sequences merge into single tokens. Idealized inverse-power shape.
seq_len = 1.0 + 6.0 * (vocab / 1_000.0) ** (-0.45)

# Embedding plus output parameters scale linearly with vocabulary size
# (rows of two matrices, fixed model width). Expressed in arbitrary units.
params = vocab / 32_000.0

fig, ax1 = plt.subplots(figsize=(5, 3))

ax1.set_xscale("log")
l1, = ax1.plot(vocab, seq_len, color=BLUE, linewidth=2.0,
               label="sequence length")
ax1.set_xlabel("vocabulary size (tokens)", color=GRAY)
ax1.set_ylabel("relative sequence length", color=GRAY)
ax1.tick_params(axis="both", colors=GRAY)
for spine in ax1.spines.values():
    spine.set_color(GRAY)

ax2 = ax1.twinx()
l2, = ax2.plot(vocab, params, color=GRAY, linewidth=2.0, linestyle="--",
               label="embedding + output parameters")
ax2.set_ylabel("relative parameter count", color=GRAY)
ax2.tick_params(axis="y", colors=GRAY)
for spine in ax2.spines.values():
    spine.set_color(GRAY)

ax1.legend(handles=[l1, l2], loc="upper center", frameon=False,
           labelcolor=GRAY, fontsize=8)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "tokenization-1")
