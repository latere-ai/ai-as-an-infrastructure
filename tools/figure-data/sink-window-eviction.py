# Regenerate app/src/figures/data/sink-window.ts: a sink-plus-window KV
# eviction policy measured on Qwen/Qwen2.5-0.5B (revision 060db64) over one
# passage written for the figure. A four-digit code appears near the start and
# is asked for again at the end, about 375 tokens later.
#
# Each policy is applied as a 4D attention mask at every layer of one float32
# forward pass: query i keeps key j when j <= i and (j < s or i - j < w), for
# s sinks and a window of w tokens. A token processed under the mask attends
# only to what a streaming cache would still hold when it was read, so the
# pass equals streaming generation with eviction. Retained keys keep their
# original positions (the rotary phase they were written with); StreamingLLM
# instead renumbers positions inside the cache, which this capture does not do.
#
# For every policy (full attention, and s in {0, 1, 4} by w in {32, 64, 128,
# 256}) the script records
#   - the per-token loss l_t = -log p(x_{t+1} | x_<=t), averaged over blocks of
#     BLOCK query positions,
#   - the probability of each digit of the code at the recall, teacher-forced,
#   - the attention of the recall query (the position that predicts the first
#     digit), averaged over all 24 layers and all 14 query heads, summed over
#     key regions: the first token, tokens 1 to 3, the four code tokens, and
#     the last w keys for each window w.
#
#   pip install torch transformers   (run with transformers 5.17.0, torch 2.14.0)
#   python tools/figure-data/sink-window-eviction.py > app/src/figures/data/sink-window.ts

import json

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL, REVISION = "Qwen/Qwen2.5-0.5B", "060db6499f32faf8b98477b0a26969ef7d8b9987"
BLOCK = 8
SINKS = [0, 1, 4]
WINDOWS = [32, 64, 128, 256]
CODE = "4729"

PASSAGE = """Mara Ellison arrived at the North Point light station on a gray morning in early March. The supply officer who met her at the landing handed over a ring of keys and told her that the storeroom lock opens with the code 4729. She wrote the number on the first page of the logbook and then carried her bags up the hill.

The first week was quiet. Each morning she climbed the tower, cleaned the lens, and checked the clockwork that turned it. In the afternoons she walked the fence line along the cliff and noted where the posts had rotted. The radio worked only at night, when the static thinned, and she used those hours to report the weather to the mainland: wind from the southwest, a falling barometer, visibility six miles.

In the second week a fishing boat anchored in the cove to wait out a squall. The skipper rowed ashore with two crewmen, and Mara made them tea in the kitchen while the rain drummed on the roof. They talked about the price of diesel, the new harbor wall, and a whale that had been seen near the islands. When the wind dropped they rowed back, and by evening the boat was gone.

The weeks that followed settled into a pattern. She painted the railings, repaired a cracked window in the watch room, and planted onions in the sheltered bed behind the cottage. Twice the supply launch came with flour, coffee, lamp wicks, and letters. Her sister wrote about the city, the long commute, and a promotion she did not want. Mara answered each letter at the kitchen table and sent the replies back with the next launch.

At the end of April a storm came in from the west. It blew for two days, tore shingles from the roof of the oil shed, and pushed spray over the top of the cliff. On the second night the generator failed and the tower went dark. Mara needed the spare lamp and a can of oil, so she took a flashlight, went down the stairs to the storeroom, and entered the code 4729"""

tok = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
model = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION, dtype=torch.float32, attn_implementation="eager").eval()
cfg = model.config

ids = tok(PASSAGE, return_tensors="pt").input_ids
N = ids.shape[1]
tokens = [tok.decode([i]) for i in ids[0].tolist()]
digits = list(CODE)
# The code occurs twice as four single-digit tokens; the last four tokens are the recall.
assert tokens[-4:] == digits, tokens[-4:]
first = next(k for k in range(N - 4) if tokens[k:k + 4] == digits)
recall = N - 5  # the query that predicts the first digit of the recall


def mask(s, w):
    i = torch.arange(N)[:, None]
    j = torch.arange(N)[None, :]
    keep = j <= i
    if w:
        keep = keep & ((j < s) | (i - j < w))
    m = torch.zeros(N, N)
    m[~keep] = float("-inf")
    return m[None, None]


def measure(s, w):
    with torch.no_grad():
        out = model(ids, attention_mask=mask(s, w), output_attentions=True)
    logp = torch.log_softmax(out.logits[0].float(), dim=-1)
    nll = -logp[:-1].gather(1, ids[0, 1:, None])[:, 0]  # nll[t]: loss of token t + 1 read at query t
    blocks = [nll[b:b + BLOCK].mean().item() for b in range(0, N - 1, BLOCK)]
    digit_p = [logp[recall + k, ids[0, recall + k + 1]].exp().item() for k in range(4)]
    att = torch.stack(out.attentions)[:, 0, :, recall, :].mean(dim=(0, 1))  # over layers and heads
    regions = {
        "first": att[0].item(),
        "next3": att[1:4].sum().item(),
        "code": att[first:first + 4].sum().item(),
        **{f"tail{w}": att[recall - w + 1:recall + 1].sum().item() for w in WINDOWS},
    }
    return blocks, digit_p, regions


def num(v, digits=3):
    s = f"{v:.{digits}f}".rstrip("0").rstrip(".")
    return s if s not in ("", "-0") else "0"


configs = [("full", 0, 0)] + [(f"s{s}w{w}", s, w) for w in WINDOWS for s in SINKS]
results = {key: measure(s, w) for key, s, w in configs}
kappa = 2 * cfg.num_hidden_layers * cfg.num_key_value_heads * (cfg.hidden_size // cfg.num_attention_heads) * 2

print("// Generated by tools/figure-data/sink-window-eviction.py; do not edit by hand.")
print("//")
print(f"// Qwen/Qwen2.5-0.5B, revision {REVISION[:7]}, one float32 forward pass per")
print("// policy over the passage in the script, with the policy applied as an")
print("// attention mask at every layer and retained keys at their original positions.")
print("// NLL: mean per-token loss in nats over blocks of BLOCK query positions")
print("// (block b covers queries b*BLOCK to b*BLOCK + BLOCK - 1; query t predicts")
print("// token t + 1). DIGITS: p of each code digit at the recall, teacher-forced.")
print("// ATTN: attention of the recall query, mean over all")
print(f"// {cfg.num_hidden_layers} layers and {cfg.num_attention_heads} query heads, summed over key regions: first (key 0),")
print("// next3 (keys 1 to 3), code (the four code tokens), tailW (the last W keys).")
print()
print(f'export const SOURCE = "Qwen/Qwen2.5-0.5B, revision {REVISION[:7]}";')
print(f"export const LAYERS = {cfg.num_hidden_layers};")
print(f"export const KV_HEADS = {cfg.num_key_value_heads};")
print(f"export const HEAD_DIM = {cfg.hidden_size // cfg.num_attention_heads};")
print(f"export const KAPPA = {kappa}; // 2 (K and V) x layers x KV heads x head width x 2 bytes (BF16)")
print(f"export const BLOCK = {BLOCK};")
print(f"export const CODE = {json.dumps(CODE)};")
print(f"export const CODE_AT = {first}; // first digit of the code in the passage")
print(f"export const RECALL = {recall}; // query that predicts the first digit of the recall")
print(f"export const TOKENS: string[] = {json.dumps(tokens, ensure_ascii=False)};")
print()
print("export interface Regions { first: number; next3: number; code: number; " + " ".join(f"tail{w}: number;" for w in WINDOWS) + " }")
print("export interface Measured { nll: number[]; digits: number[]; attn: Regions }")
print("export const RUNS: Record<string, Measured> = {")
for key, _, _ in configs:
    blocks, digit_p, regions = results[key]
    print(f"  {key}: {{")
    print("    nll: [" + ", ".join(num(v, 2) for v in blocks) + "],")
    print("    digits: [" + ", ".join(f"{v:.3g}" for v in digit_p) + "],")
    print("    attn: { " + ", ".join(f"{k}: {num(v, 4)}" for k, v in regions.items()) + " },")
    print("  },")
print("};")
