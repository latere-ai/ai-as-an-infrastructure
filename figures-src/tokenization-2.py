import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
from matplotlib.patches import FancyBboxPatch

# Audit workflow only. It contains no fabricated token counts or language
# ranking; a real report should populate premiums from pinned parallel data.

GRAY = "#6b7280"
BLUE = "#3b82f6"

fig, ax = plt.subplots(figsize=(7.2, 2.5))
ax.set_xlim(0, 1)
ax.set_ylim(0, 1)
ax.axis("off")

labels = [
    "Pinned parallel text\nsame content",
    "One pinned\nnormalization policy",
    "One tokenizer\nartifact",
    "Premium distribution\nby language + domain",
]
centers = [0.12, 0.37, 0.62, 0.87]

for index, (x, label) in enumerate(zip(centers, labels)):
    box = FancyBboxPatch(
        (x - 0.095, 0.47), 0.19, 0.28,
        boxstyle="round,pad=0.02,rounding_size=0.025",
        facecolor="#f1ece1", edgecolor=BLUE if index == 3 else GRAY,
        linewidth=1.5 if index == 3 else 1.0,
    )
    ax.add_patch(box)
    ax.text(x, 0.61, label, ha="center", va="center", color=GRAY, fontsize=8.5)
    if index < len(centers) - 1:
        ax.annotate(
            "", xy=(centers[index + 1] - 0.105, 0.61), xytext=(x + 0.105, 0.61),
            arrowprops=dict(arrowstyle="->", color=GRAY, linewidth=1.1),
        )

ax.text(0.5, 0.24, "p_l = tokens_l / tokens_reference",
        ha="center", va="center", color=GRAY, fontsize=9)
ax.text(0.5, 0.10, "Report median, p95, and truncation at the deployed context limit",
        ha="center", va="center", color=GRAY, fontsize=8)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "tokenization-2")
