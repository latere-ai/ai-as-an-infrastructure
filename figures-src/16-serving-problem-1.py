import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Schematic of the KV-cache memory squeeze. The KV cache grows linearly with
# the number of cached tokens (KV bytes = 2 * L * n_kv * d_head * b_dtype * T),
# so per-request memory is a straight line in sequence length. A fixed weights
# slice eats part of total accelerator memory, and the leftover pool caps how
# many concurrent requests can be batched. Idealized synthetic numbers, not
# measured data. After Kwon et al. (2023), PagedAttention / vLLM.

INK = "#6b7280"
DATA = "#3b82f6"

# Idealized device budget (one accelerator), in gigabytes.
total_mem = 80.0      # total accelerator memory
weights = 28.0        # fixed weights slice
pool = total_mem - weights  # leftover KV pool

# KV bytes per token for an illustrative model, in megabytes per token.
# Stands in for 2 * L * n_kv * d_head * b_dtype.
kv_per_token_mb = 0.20

# Per-request cache size as a linear function of cached tokens.
tokens = np.linspace(0, 16000, 400)
per_request_gb = kv_per_token_mb * tokens / 1024.0

fig, ax = plt.subplots(figsize=(5, 3))

# The leftover pool as a horizontal ceiling.
ax.axhline(pool, color=INK, lw=1.2, ls="--")
ax.text(400, pool + 1.0, "leftover KV pool (total minus weights)",
        color=INK, fontsize=8.5, va="bottom")

# One request's cache grows linearly with context length.
ax.plot(tokens, per_request_gb, color=DATA, lw=1.8,
        label="one request's KV cache")

# Stack a handful of concurrent requests to show the pool filling up.
# Each request here holds the same illustrative context length.
ctx = 8000.0
one = kv_per_token_mb * ctx / 1024.0   # GB held by one request at ctx
n_fit = int(pool // one)               # how many fit in the pool
for i in range(1, n_fit + 1):
    ax.plot([ctx, ctx], [(i - 1) * one, i * one],
            color=DATA, lw=4, alpha=0.35, solid_capstyle="butt")
ax.annotate(f"pool holds {n_fit} such requests",
            xy=(ctx, n_fit * one), xytext=(ctx - 6600, pool * 0.42),
            color=INK, fontsize=8.5,
            arrowprops=dict(arrowstyle="->", color=INK, lw=1.0))

ax.set_xlim(0, tokens.max())
ax.set_ylim(0, total_mem - weights + 6)
ax.set_xlabel("cached tokens per request (context length)", color=INK)
ax.set_ylabel("KV cache memory (GB)", color=INK)

for spine in ("top", "right"):
    ax.spines[spine].set_visible(False)
for spine in ("left", "bottom"):
    ax.spines[spine].set_color(INK)
ax.tick_params(colors=INK, which="both")
for lbl in ax.get_xticklabels() + ax.get_yticklabels():
    lbl.set_color(INK)

leg = ax.legend(frameon=False, fontsize=8, loc="lower right")
for txt in leg.get_texts():
    txt.set_color(INK)

fig.tight_layout()
for _out in (
    "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/en/figures/16-serving-problem-1.svg",
    "/Users/changkun/dev/latere.ai/ai-as-an-infrastructure/zh/figures/16-serving-problem-1.svg",
):
    fig.savefig(_out, format="svg", bbox_inches="tight", transparent=True)
