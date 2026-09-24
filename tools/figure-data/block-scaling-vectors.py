# Regenerate the VECTORS block of app/src/figures/block-scaling.ts: two real
# 896-value vectors from layer 12 of Qwen/Qwen2.5-0.5B, the input side of that
# layer's query projection (self_attn.q_proj, 896 inputs):
#
#   weight      row 0 of the q_proj weight matrix
#   activation  the vector q_proj receives for the token " mat" in the sentence
#               below (the RMSNorm output), captured with a forward pre-hook
#               from one float32 forward pass
#
# Values are printed to four significant digits; the figure quantizes the
# printed values, so the page and this script agree on the inputs exactly.
#
#   pip install torch transformers   (run with transformers 5.17.0, torch 2.14.0)
#   python tools/figure-data/block-scaling-vectors.py

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL, REVISION = "Qwen/Qwen2.5-0.5B", "060db6499f32faf8b98477b0a26969ef7d8b9987"
LAYER, ROW = 12, 0
SENTENCE, TOKEN = "The cat sat on the mat because it was tired.", " mat"

tok = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
model = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION, dtype=torch.float32).eval()
proj = model.model.layers[LAYER].self_attn.q_proj

captured = {}
proj.register_forward_pre_hook(lambda module, args: captured.__setitem__("x", args[0][0].detach()))
ids = tok(SENTENCE, return_tensors="pt").input_ids
with torch.no_grad():
    model(ids)
tokens = [tok.decode([i]) for i in ids[0].tolist()]
position = tokens.index(TOKEN)


def literal(values):
    return ", ".join(f"{v:.4g}" for v in values)


print("const VECTORS = {")
print(f"  weight: [{literal(proj.weight[ROW].detach().tolist())}],")
print(f"  activation: [{literal(captured['x'][position].tolist())}],")
print("};")
