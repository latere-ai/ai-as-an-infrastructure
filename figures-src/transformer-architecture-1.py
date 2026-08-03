import matplotlib
matplotlib.use("svg")
import matplotlib.pyplot as plt
import numpy as np

# Exact dense KV payload under the assumptions stated in the chapter:
#   32 layers, head width 128, batch 1, two bytes per KV element.
# The horizontal comparison is 7 billion parameters at two bytes each.
# Allocator overhead, runtime workspace, and cache quantization metadata are
# deliberately excluded.

GRAY = "#6b7280"
BLUE = "#3b82f6"

layers = 32
head_width = 128
batch_size = 1
bytes_per_kv_element = 2
weight_gib = 7_000_000_000 * 2 / 2**30
sequence = np.linspace(0, 256_000, 400)

variants = {
    "MHA (32 KV heads)": 32,
    "GQA (8 KV heads)": 8,
    "MQA (1 KV head)": 1,
}

fig, ax = plt.subplots(figsize=(5.2, 3.1))

styles = [
    (BLUE, "-"),
    (GRAY, "--"),
    (GRAY, ":"),
]

for (label, kv_heads), (color, linestyle) in zip(variants.items(), styles):
    payload_gib = (
        2
        * layers
        * batch_size
        * sequence
        * kv_heads
        * head_width
        * bytes_per_kv_element
        / 2**30
    )
    ax.plot(sequence / 1000, payload_gib, color=color, linestyle=linestyle,
            linewidth=2.0, label=label)

    bytes_per_token = (
        2 * layers * batch_size * kv_heads * head_width * bytes_per_kv_element
    )
    crossover = 7_000_000_000 * 2 / bytes_per_token
    if crossover <= sequence[-1]:
        ax.plot(crossover / 1000, weight_gib, marker="o", color=color,
                markersize=4)

ax.axhline(weight_gib, color=GRAY, linewidth=1.2, linestyle="-.",
           label="7B weights at 2 bytes / parameter")
ax.set_xlabel("context length (thousands of tokens)")
ax.set_ylabel("KV payload (GiB)")
ax.set_xlim(0, sequence[-1] / 1000)
ax.set_ylim(0, 132)
ax.legend(loc="upper left", frameon=False, labelcolor=GRAY, fontsize=7.5)

for spine in ["top", "right"]:
    ax.spines[spine].set_visible(False)
for spine in ["left", "bottom"]:
    ax.spines[spine].set_color(GRAY)
ax.tick_params(colors=GRAY)
ax.xaxis.label.set_color(GRAY)
ax.yaxis.label.set_color(GRAY)

fig.tight_layout()
from common import save_bilingual

save_bilingual(fig, "transformer-architecture-1")
