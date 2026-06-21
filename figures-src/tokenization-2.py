import os

import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic illustration of tokenizer fertility across languages.
# A tokenizer tuned on English-heavy data encodes the same meaning in many
# more tokens for some languages than for others, inflating cost and latency
# and shrinking the effective context window. Idealized synthetic token
# counts for one fixed sentence, after Petrov et al. (2023).

GRAY = "#6b7280"
BLUE = "#3b82f6"

# Languages ordered from fewest to most tokens for the same meaning.
# Values are illustrative, not measured.
languages = ["English", "Spanish", "German", "Russian",
             "Hindi", "Arabic", "Burmese"]
tokens = np.array([12, 16, 18, 27, 41, 46, 72], dtype=float)

# Fertility relative to English makes the unfairness explicit.
fertility = tokens / tokens[0]

y = np.arange(len(languages))

fig, ax = plt.subplots(figsize=(5, 3))

ax.barh(y, tokens, color=BLUE, height=0.62)
ax.set_yticks(y)
ax.set_yticklabels(languages, color=GRAY)
ax.invert_yaxis()  # English at the top
ax.set_xlabel("tokens for the same sentence", color=GRAY)
ax.tick_params(axis="both", colors=GRAY)
for spine in ax.spines.values():
    spine.set_color(GRAY)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)

# Annotate each bar with its fertility multiple relative to English.
for yi, (tok, fert) in enumerate(zip(tokens, fertility)):
    ax.text(tok + 1.5, yi, f"{fert:.1f}x", va="center", ha="left",
            color=GRAY, fontsize=8)

ax.set_xlim(0, tokens.max() * 1.18)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "tokenization-2")
