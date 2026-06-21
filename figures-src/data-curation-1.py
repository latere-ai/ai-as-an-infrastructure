import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic: why MinHash with LSH avoids the all-pairs blow-up at corpus scale.
# All-pairs fuzzy dedup compares every document with every other document, so
# the number of comparisons grows like O(n^2). LSH routes only documents that
# share a band-bucket into a comparison, so the candidate count grows close to
# linearly. These are idealized counts, not measured throughput.

GRAY = "#6b7280"
BLUE = "#3b82f6"

# Corpus size in documents (log-spaced).
n = np.logspace(3, 9, 200)

# All-pairs comparisons: n*(n-1)/2 ~ O(n^2).
all_pairs = n * (n - 1) / 2.0

# LSH candidate comparisons: near-linear. A small constant of candidate pairs
# per document survives the band-bucket routing.
candidates_per_doc = 8.0
lsh = candidates_per_doc * n

fig, ax = plt.subplots(figsize=(5, 3))

ax.loglog(n, all_pairs, color=GRAY, linewidth=1.8, linestyle="--",
          label=r"All-pairs  $O(n^2)$")
ax.loglog(n, lsh, color=BLUE, linewidth=2.0,
          label=r"MinHash + LSH  $\approx O(n)$")

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
