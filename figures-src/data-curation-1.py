import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic: indexed candidate generation can avoid the all-pairs blow-up when
# each document emits a bounded number of candidates. This is a favorable
# operating assumption, not an LSH worst-case bound; a degenerate bucket can
# still contain all document pairs. These are idealized counts, not throughput.

GRAY = "#6b7280"
BLUE = "#3b82f6"

# Corpus size in documents (log-spaced).
n = np.logspace(3, 9, 200)

# All-pairs comparisons: n*(n-1)/2 ~ O(n^2).
all_pairs = n * (n - 1) / 2.0

# Indexed candidate comparisons under the explicit assumption that eight
# candidate pairs survive per document.
candidates_per_doc = 8.0
lsh = candidates_per_doc * n

fig, ax = plt.subplots(figsize=(5, 3))

ax.loglog(n, all_pairs, color=GRAY, linewidth=1.8, linestyle="--",
          label="All-pairs O(n^2)")
ax.loglog(n, lsh, color=BLUE, linewidth=2.0,
          label="Indexed example (8 candidates/doc)")

ax.set_xlabel("Documents in corpus (n)", color=GRAY)
ax.set_ylabel("Pairwise comparisons", color=GRAY)

ax.tick_params(colors=GRAY, which="both")
for spine in ax.spines.values():
    spine.set_color(GRAY)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)

leg = ax.legend(frameon=False, loc="upper left", fontsize=9)
for text in leg.get_texts():
    text.set_color(GRAY)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "data-curation-1")
