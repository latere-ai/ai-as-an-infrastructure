# Regenerate the TRAIN and SERVE blocks of app/src/figures/process-timescales.ts.
#
# Training numbers come from the DeepSeek-V3 Technical Report (arXiv
# 2412.19437v2): Table 1 (H800 GPU-hours by stage), section 3.1 (a cluster of
# 2,048 H800 GPUs), and section 4.2 (4K-token sequences, 14.8T tokens, the
# batch ramped from 3,072 to 15,360 sequences over the first 469B tokens, and
# 180K GPU-hours per trillion tokens). Serving numbers come from DeepSeek's
# "DeepSeek-V3/R1 Inference System Overview" (open-infra-index,
# 202502OpenSourceWeek, day 6), the 24 hours from 2025-02-27 12:00 UTC+8.
#
# Derived values:
#   days per stage       GPU-hours / 2,048 GPUs / 24
#   optimizer steps      ramp: integral of dx / (4,096 b(x)) with b linear in
#                        tokens from 3,072 to 15,360 over 469B tokens, which is
#                        469e9 / (4,096 (15,360 - 3,072)) ln(15,360 / 3,072);
#                        then (14.8e12 - 469e9) / (15,360 x 4,096)
#   seconds per step     180K GPU-hours per 1e12 tokens, times 15,360 x 4,096
#                        tokens, over 2,048 GPUs
#
#   python tools/figure-data/process-timescales.py   (standard library only)

import html
import math
import re
import urllib.request

PAPER = "https://arxiv.org/html/2412.19437v2"
SERVING = ("https://raw.githubusercontent.com/deepseek-ai/open-infra-index/main/"
           "202502OpenSourceWeek/day_6_one_more_thing_deepseekV3R1_inference_system_overview.md")


def fetch(url):
    with urllib.request.urlopen(url) as r:
        return r.read().decode("utf-8", "ignore")


def plain(page):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", page)))


def need(pattern, source, name):
    m = re.search(pattern, source)
    if not m:
        raise SystemExit(f"{name}: pattern not found: {pattern}")
    return m


paper = plain(fetch(PAPER))
table = need(r"in H800 GPU Hours (\d+)K (\d+)K (\d+)K (\d+)K", paper, "Table 1")
pre, ext, post, total = (int(v) * 1000 for v in table.groups())
gpus = int(need(r"trained on a cluster equipped with (\d+) NVIDIA H800 GPUs", paper, "cluster").group(1))
per_t = int(need(r"each trillion tokens requires only (\d+)K H800 GPU hours", paper, "rate").group(1)) * 1000
b0, b1, ramp = need(r"batch size is gradually increased from (\d+) to (\d+) in the training of the first (\d+)B tokens", paper, "batch").groups()
b0, b1, ramp = int(b0), int(b1), int(ramp) * 1e9
tokens = float(need(r"pre-train DeepSeek-V3 on ([\d.]+)T tokens", paper, "tokens").group(1)) * 1e12
seq = 4096  # "maximum sequence length to 4K"
need(r"maximum sequence length to 4K during pre-training", paper, "sequence length")

serving = fetch(SERVING)
speed = [int(v) for v in need(r"average output speed was (\d+)[–-](\d+) tokens per second", serving, "speed").groups()]
prefill = float(need(r"~([\d.]+)k tokens/s input", serving, "prefill throughput").group(1)) * 1e3
decode = float(need(r"~([\d.]+)k tokens/s output", serving, "decode throughput").group(1)) * 1e3
nodes = float(need(r"average occupancy of ([\d.]+) nodes", serving, "occupancy").group(1))
gpus_per_node = int(need(r"each node contains (\d+) H800 GPUs", serving, "node size").group(1))

days = {k: v / gpus / 24 for k, v in {"pre": pre, "ext": ext, "post": post, "total": total}.items()}
ramp_steps = ramp / (seq * (b1 - b0)) * math.log(b1 / b0)
rest_steps = (tokens - ramp) / (b1 * seq)
steps = ramp_steps + rest_steps
step_seconds = per_t * (b1 * seq) / 1e12 / gpus * 3600

print("export const TRAIN = {")
print(f"  gpus: {gpus},")
print(f"  gpuHours: {{ pre: {pre:_}, ext: {ext:_}, post: {post:_}, total: {total:_} }},")
print("  days: { " + ", ".join(f"{k}: {v:.3f}" for k, v in days.items()) + " },")
print(f"  steps: {round(steps, -2):_.0f}, // ramp {ramp_steps:,.0f} + constant batch {rest_steps:,.0f}")
print(f"  stepSeconds: {step_seconds:.1f},")
print("};")
print("export const SERVE = {")
print(f"  tokensPerSecond: {sum(speed) / 2:g}, // midpoint of {speed[0]} to {speed[1]}")
print(f"  gpuSecondsPerInput: {gpus_per_node} / {prefill:_.0f},")
print(f"  gpuSecondsPerOutput: {gpus_per_node} / {decode:_.0f},")
print(f"  fleetGpuHoursPerDay: {nodes} * {gpus_per_node} * 24,")
print("};")
print(f"// training GPU-hours equal {total / (nodes * gpus_per_node * 24):.1f} days of the reported serving fleet")
