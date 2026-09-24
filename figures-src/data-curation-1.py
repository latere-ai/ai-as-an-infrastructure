import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FixedLocator, FuncFormatter, NullFormatter
import numpy as np

# Schematic: indexed candidate generation can avoid the all-pairs blow-up when
# each document emits a bounded number of candidates. This is a favorable
# operating assumption, not an LSH worst-case bound. The dotted line adds one
# degenerate bucket that holds a fixed fraction f of the corpus: its
# (f n)(f n - 1) / 2 internal pairs grow quadratically, so the indexed work
# bends back toward the all-pairs line. These are idealized counts, not
# throughput.
#
# Tick labels are plain text with superscript digits (10³), not mathtext, so
# they render in the page's sans-serif font like the other labels.

GRAY = "#6b7280"
BLUE = "#3b82f6"
TEAL = "#14b8a6"

# Corpus size in documents (log-spaced).
n = np.logspace(3, 9, 200)

# All-pairs comparisons: n(n - 1) / 2.
all_pairs = n * (n - 1) / 2.0

# Indexed candidate comparisons under the explicit assumption that eight
# candidate pairs survive per document.
candidates_per_doc = 8.0
lsh = candidates_per_doc * n

# The same index with one bucket that holds 1% of the documents.
bucket_share = 0.01
in_bucket = bucket_share * n
degenerate = lsh + in_bucket * (in_bucket - 1) / 2.0

fig, ax = plt.subplots(figsize=(5, 3.1))

ax.loglog(n, all_pairs, color=GRAY, linewidth=1.8, linestyle="--",
          label="All pairs, n(n − 1)/2")
ax.loglog(n, degenerate, color=TEAL, linewidth=2.0, linestyle=":",
          label="8 per document + one 1% bucket")
ax.loglog(n, lsh, color=BLUE, linewidth=2.0,
          label="8 candidates per document")

SUP = str.maketrans("0123456789-", "⁰¹²³⁴⁵⁶⁷⁸⁹⁻")


def power_of_ten(value, _pos):
    return "10" + str(int(round(np.log10(value)))).translate(SUP)


ax.xaxis.set_major_locator(FixedLocator([10.0 ** k for k in range(3, 10)]))
ax.yaxis.set_major_locator(FixedLocator([10.0 ** k for k in range(4, 19, 2)]))
for axis in (ax.xaxis, ax.yaxis):
    axis.set_major_formatter(FuncFormatter(power_of_ten))
    axis.set_minor_formatter(NullFormatter())
ax.set_ylim(3e3, 3e18)

ax.set_xlabel("Documents in corpus (n)", color=GRAY)
ax.set_ylabel("Pairwise comparisons", color=GRAY)

ax.tick_params(colors=GRAY, which="both")
for spine in ax.spines.values():
    spine.set_color(GRAY)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)

leg = ax.legend(frameon=False, loc="upper left", fontsize=8.5)
for text in leg.get_texts():
    text.set_color(GRAY)

fig.tight_layout()
from common import ZH_TEXT, save_bilingual

# Labels this figure adds beyond the shared table.
ZH_TEXT.update({
    "All pairs, n(n − 1)/2": "全配对比较，n(n − 1)/2",
    "8 per document + one 1% bucket": "每篇 8 个 + 一个 1% 的桶",
    "8 candidates per document": "每篇文档 8 个候选",
})

save_bilingual(fig, "data-curation-1")
