# Regenerate the CONVERSATIONS block of app/src/figures/sft-loss-mask.ts: one
# tool-using conversation per book language, serialized with the chat template
# that ships with Qwen/Qwen2.5-0.5B (revision 060db64), tokenized with its
# tokenizer, and scored by one float32 forward pass of the same base model
# before any fine-tuning. For every token u_t the script records its text, the
# turn and role it belongs to, which part of the turn it is (template header,
# message content, end-of-turn token, separator), and the per-token loss
#
#   l_t = -log p_theta(u_t | u_<t)
#
# in nats. The first token has no prefix and no loss. For left truncation the
# script also scores the last k tokens alone for every kept length k from
# KEEP_MIN in steps of KEEP_STEP below the full length, since dropping the start of the sequence
# changes the context of every token that remains. Right truncation keeps the
# prefix, so its losses equal the full-sequence ones and are not stored.
# Prints a TypeScript object literal to paste.
#
#   pip install torch transformers   (run with transformers 5.17.0, torch 2.14.0)
#   python tools/figure-data/sft-mask-losses.py

import json

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL, REVISION = "Qwen/Qwen2.5-0.5B", "060db6499f32faf8b98477b0a26969ef7d8b9987"
KEEP_MIN, KEEP_STEP = 24, 4  # the figure's "keep at most" slider

CONVERSATIONS = {
    "en": [
        {"role": "system", "content": "You are a weather assistant. Answer in one sentence."},
        {"role": "user", "content": "Do I need an umbrella in Paris today?"},
        {"role": "assistant", "content": "", "tool_calls": [{"type": "function", "function": {"name": "get_weather", "arguments": {"city": "Paris"}}}]},
        {"role": "tool", "content": "{\"city\": \"Paris\", \"rain\": 0.8}"},
        {"role": "assistant", "content": "Yes. Rain is likely in Paris today, with an 80% chance."},
    ],
    "zh": [
        {"role": "system", "content": "你是天气助手，请用一句话回答。"},
        {"role": "user", "content": "今天在巴黎需要带伞吗？"},
        {"role": "assistant", "content": "", "tool_calls": [{"type": "function", "function": {"name": "get_weather", "arguments": {"city": "巴黎"}}}]},
        {"role": "tool", "content": "{\"city\": \"巴黎\", \"rain\": 0.8}"},
        {"role": "assistant", "content": "需要。巴黎今天下雨的概率是 80%。"},
    ],
}

tok = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
model = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION, dtype=torch.float32).eval()


def pieces(messages):
    """The template's output as labeled spans, mirroring the Qwen2.5 template
    for a conversation without a tools list. Each span is (text, turn, role, part)."""
    out = []
    for i, m in enumerate(messages):
        if m["role"] == "tool":
            # Tool results are serialized inside a user turn.
            out.append(("<|im_start|>user\n", i, "tool", "header"))
            out.append(("<tool_response>\n" + m["content"] + "\n</tool_response>", i, "tool", "content"))
        else:
            role = "call" if m.get("tool_calls") else m["role"]
            out.append(("<|im_start|>" + m["role"] + "\n", i, role, "header"))
            if m.get("tool_calls"):
                call = m["tool_calls"][0]["function"]
                body = "<tool_call>\n{\"name\": \"" + call["name"] + "\", \"arguments\": " + json.dumps(call["arguments"], ensure_ascii=False) + "}\n</tool_call>"
                out.append((body, i, "call", "content"))
            else:
                out.append((m["content"], i, m["role"], "content"))
        out.append(("<|im_end|>", i, out[-1][2], "eot"))
        out.append(("\n", i, out[-1][2], "sep"))
    return out


def losses(ids):
    with torch.no_grad():
        logits = model(torch.tensor([ids])).logits[0]
    logp = torch.log_softmax(logits.float(), dim=-1)
    return [None] + [-logp[t - 1, ids[t]].item() for t in range(1, len(ids))]


def fmt(v):
    return "null" if v is None else f"{v:.2f}"


for lang, messages in CONVERSATIONS.items():
    rendered = tok.apply_chat_template(messages, tokenize=False)
    spans = pieces(messages)
    text = "".join(s[0] for s in spans)
    assert text == rendered, (text, rendered)
    # Character labels, then one label per token; a token must not straddle two spans.
    labels = []
    for s in spans:
        labels += [s[1:]] * len(s[0])
    enc = tok(rendered, return_offsets_mapping=True, add_special_tokens=False)
    ids = enc["input_ids"]
    rows = []
    for tid, (a, b) in zip(ids, enc["offset_mapping"]):
        span = set(labels[a:b])
        assert len(span) == 1, (lang, tok.decode([tid]), span)
        turn, role, part = span.pop()
        rows.append((tok.decode([tid]), turn, role, part))
    full = losses(ids)
    T = len(ids)
    left = {}
    for k in range(KEEP_MIN, T, KEEP_STEP):
        left[k] = losses(ids[T - k:])
    print(f"  {lang}: {{")
    print(f"    tokens: [")
    for (s, turn, role, part), l in zip(rows, full):
        print(f"      [{json.dumps(s, ensure_ascii=False)}, {turn}, \"{role}\", \"{part}\", {fmt(l)}],")
    print("    ],")
    print("    left: {")
    for k, ls in left.items():
        print(f"      {k}: [" + ", ".join(fmt(v) for v in ls) + "],")
    print("    },")
    print("  },")
