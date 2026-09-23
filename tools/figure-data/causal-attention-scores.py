# Regenerate the SCORES block of app/src/figures/causal-attention.ts: the
# pre-softmax attention scores q.k / sqrt(d_h) of three heads of
# Qwen/Qwen2.5-0.5B over one English and one Chinese sentence, captured from
# the eager attention path of one float32 forward pass (full square, before the
# causal mask is added). Prints a TypeScript object literal to paste.
#
#   pip install torch transformers   (run with transformers 5.17.0, torch 2.14.0)
#   python tools/figure-data/causal-attention-scores.py

import json

import torch
import transformers.models.qwen2.modeling_qwen2 as qwen2
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL, REVISION = "Qwen/Qwen2.5-0.5B", "060db6499f32faf8b98477b0a26969ef7d8b9987"
SENTENCES = {"en": "The cat sat on the mat because it was tired.", "zh": "小猫坐在垫子上，它很累。"}
HEADS = [(5, 5), (8, 7), (11, 7)]  # subject noun, previous token, first token

tok = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
model = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION, dtype=torch.float32, attn_implementation="eager").eval()

captured = {}
eager = qwen2.eager_attention_forward


def capture(module, query, key, value, attention_mask, scaling, dropout=0.0, **kw):
    k = qwen2.repeat_kv(key, module.num_key_value_groups)
    captured[module.layer_idx] = (torch.matmul(query, k.transpose(2, 3)) * scaling)[0].detach()
    return eager(module, query, key, value, attention_mask, scaling, dropout, **kw)


qwen2.eager_attention_forward = capture

for lang, text in SENTENCES.items():
    ids = tok(text, return_tensors="pt").input_ids
    captured.clear()
    with torch.no_grad():
        model(ids)
    tokens = [tok.decode([i]) for i in ids[0].tolist()]
    print(f"  {lang}: {{")
    print(f"    text: {json.dumps(text, ensure_ascii=False)},")
    print(f"    tokens: {json.dumps(tokens, ensure_ascii=False)},")
    for layer, head in HEADS:
        rows = captured[layer][head].tolist()
        body = ",\n".join("      [" + ", ".join(f"{v:.2f}".rstrip("0").rstrip(".") for v in r) + "]" for r in rows)
        print(f"    L{layer}H{head}: [\n{body}\n    ],")
    print("  },")
