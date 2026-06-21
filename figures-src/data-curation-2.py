import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic: the quantity-versus-quality trade-off. Raw web tokens carry
# duplicates and junk, so held-out loss flattens early as added volume repeats
# content the model has already seen. The same compute spent on deduplicated
# and quality-filtered tokens keeps every added token informative, so loss
# keeps falling. The crossing point is the regime where filtering beats raw
# volume. These curves are idealized, not measured loss.

GRAY = "#6b7280"
BLUE = "#3b82f6"

# Tokens consumed, in arbitrary log-spaced units.
t = np.logspace(0, 3, 300)

# Idealized power-law descent toward an irreducible floor. Raw web data has a
# higher floor and a larger fraction of redundant tokens, so its effective
# token count saturates: loss bottoms out early.
floor_raw = 2.3
floor_clean = 1.9

# Raw web: effective tokens saturate (redundancy), so progress stalls.
eff_raw = 60.0 * (1.0 - np.exp(-t / 40.0))
loss_raw = floor_raw + 1.7 * (eff_raw + 1.0) ** (-0.5)

# Deduplicated and filtered: nearly every token is informative.
loss_clean = floor_clean + 1.7 * (t + 1.0) ** (-0.28)

fig, ax = plt.subplots(figsize=(5, 3))

ax.semilogx(t, loss_raw, color=GRAY, linewidth=1.8, linestyle="--",
            label="Raw web (duplicated, noisy)")
ax.semilogx(t, loss_clean, color=BLUE, linewidth=2.0,
            label="Deduplicated + filtered")

ax.set_xlabel("Tokens consumed (log scale)", color=GRAY)
ax.set_ylabel("Held-out loss", color=GRAY)

ax.tick_params(colors=GRAY, which="both")
ax.set_yticklabels([])
for spine in ax.spines.values():
    spine.set_color(GRAY)
ax.spines["top"].set_visible(False)
ax.spines["right"].set_visible(False)

leg = ax.legend(frameon=False, loc="upper right", fontsize=9)
for text in leg.get_texts():
    text.set_color(GRAY)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "data-curation-2")
