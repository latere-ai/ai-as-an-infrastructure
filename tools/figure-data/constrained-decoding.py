# Regenerate app/src/figures/data/constrained-decoding.ts: greedy decoding of
# one extraction prompt by Qwen/Qwen2.5-0.5B (revision 060db64), without a
# grammar and under a JSON-schema grammar, with and without jump-forward.
#
# The schema is {"name": string, "born": {"year": integer, "city": string}}
# with a fixed key order and fixed separators (one space after ":" and ","),
# the compact form many engines emit when whitespace is not free. It compiles
# to a byte-level automaton over the template
#
#   [" "] {"name": "<STR>", "born": {"year": <INT>, "city": "<STR>"}}
#
# where STR is a JSON string body (escapes and UTF-8 multi-byte sequences
# tracked byte by byte) and INT is a JSON integer. A token is admissible when
# the parser can consume every byte of it from the current state; every state
# of this automaton still has an accepting completion, so that is also the
# chapter's "keeps an accepting completion reachable" condition. The end of
# sequence token is admissible only in the accepting state, and no other
# special token ever is. Token bytes come from the byte-level BPE table, not
# from decoding each token alone, which garbles partial UTF-8.
#
# Each step records the model distribution p over the whole vocabulary, the
# admissible set A(s_t), the legal mass Z = sum_{u in A} p(u), the eight most
# probable tokens (plus the committed token and the three most probable
# admissible ones when they are not among them), and the committed token,
# the argmax of p_G = p 1[v in A] / Z. With jump-forward, whenever the parser
# admits exactly one continuation byte string, the runtime appends it,
# retokenizes the generated text, and runs one extend pass over the tokens
# that changed (SGLang's compressed finite-state machine).
#
#   pip install torch transformers   (run with transformers 5.17.0, torch 2.14.0)
#   python tools/figure-data/constrained-decoding.py > app/src/figures/data/constrained-decoding.ts

import json


def sig(v):
    return float(f"{v:.4g}")

import torch
from transformers import AutoModelForCausalLM, AutoTokenizer

MODEL, REVISION = "Qwen/Qwen2.5-0.5B", "060db6499f32faf8b98477b0a26969ef7d8b9987"
PROMPT = 'Extract the person as JSON with keys "name" and "born" ("year", "city").\nText: Ada Lovelace was born in London in 1815 and died in 1852.\nJSON:'
TOP = 8
MAX_STEPS = 60

tok = AutoTokenizer.from_pretrained(MODEL, revision=REVISION)
model = AutoModelForCausalLM.from_pretrained(MODEL, revision=REVISION, dtype=torch.float32).eval()
EOS = tok.eos_token_id
VOCAB = len(tok)  # tokenizer vocabulary; the logit rows beyond it are padding

# ---------------------------------------------------------------- token bytes


def byte_decoder():
    bs = list(range(ord("!"), ord("~") + 1)) + list(range(ord("¡"), ord("¬") + 1)) + list(range(ord("®"), ord("ÿ") + 1))
    cs = bs[:]
    n = 0
    for b in range(256):
        if b not in bs:
            bs.append(b)
            cs.append(256 + n)
            n += 1
    return {chr(c): b for b, c in zip(bs, cs)}


BD = byte_decoder()
special = set(tok.all_special_ids) | {i for i in range(VOCAB) if tok.convert_ids_to_tokens(i) in tok.get_added_vocab()}
TOKEN_BYTES = [None] * VOCAB
for i in range(VOCAB):
    if i in special:
        continue
    TOKEN_BYTES[i] = bytes(BD[c] for c in tok.convert_ids_to_tokens(i))

# ---------------------------------------------------------------- grammar
# Segments of the template; literals start with the byte that closes the
# preceding hole, so a string's closing quote belongs to the next literal.
SEGS = [
    ("ws", None, None),
    ("lit", b'{"name": "', None),
    ("str", None, "name"),
    ("lit", b'", "born": {"year": ', None),
    ("int", None, "year"),
    ("lit", b', "city": "', None),
    ("str", None, "city"),
    ("lit", b'"}}', None),
    ("end", None, None),
]
HEX = set(b"0123456789abcdefABCDEF")


def step(state, b):
    """Advance by one byte; None if the byte is not admissible."""
    seg, sub = state
    kind, lit, _ = SEGS[seg]
    if kind == "ws":
        if sub == 0 and b == 0x20:
            return (0, 1)
        return step((1, 0), b)
    if kind == "lit":
        if lit[sub] != b:
            return None
        return (seg + 1, 0) if sub + 1 == len(lit) else (seg, sub + 1)
    if kind == "str":
        # sub: 0 plain, 1 after backslash, 2..5 hex digits still needed (+2), 10+k UTF-8 continuations needed
        if sub == 0:
            if b == 0x22:
                return step((seg + 1, 0), b)
            if b == 0x5C:
                return (seg, 1)
            if b < 0x20:
                return None
            if b < 0x80:
                return (seg, 0)
            if 0xC2 <= b <= 0xDF:
                return (seg, 11)
            if 0xE0 <= b <= 0xEF:
                return (seg, 12)
            if 0xF0 <= b <= 0xF4:
                return (seg, 13)
            return None
        if sub == 1:
            if b in b'"\\/bfnrt':
                return (seg, 0)
            return (seg, 5) if b == ord("u") else None
        if 2 <= sub <= 5:
            if b not in HEX:
                return None
            return (seg, 0) if sub == 2 else (seg, sub - 1)
        if sub >= 11:
            if not 0x80 <= b <= 0xBF:
                return None
            return (seg, 0) if sub == 11 else (seg, sub - 1)
    if kind == "int":
        # sub: 0 start, 1 after '-', 2 a leading zero, 3 digits
        if sub in (0, 1):
            if b == ord("0"):
                return (seg, 2)
            if ord("1") <= b <= ord("9"):
                return (seg, 3)
            return (seg, 1) if sub == 0 and b == ord("-") else None
        if sub == 3 and ord("0") <= b <= ord("9"):
            return (seg, 3)
        return step((seg + 1, 0), b)
    return None  # end: no more bytes


def consume(state, bs):
    for b in bs:
        state = step(state, b)
        if state is None:
            return None
    return state


def forced(state):
    """The byte string the parser admits as the only continuation, if any."""
    out = b""
    while True:
        seg, sub = state
        kind, lit, _ = SEGS[seg]
        if kind != "lit":
            return out
        out += lit[sub:]
        state = (seg + 1, 0)


START = (0, 0)
ACCEPT = (len(SEGS) - 1, 0)
_masks = {}


def admissible(state):
    if state not in _masks:
        m = torch.zeros(VOCAB, dtype=torch.bool)
        for i, bs in enumerate(TOKEN_BYTES):
            if bs is not None and consume(state, bs) is not None:
                m[i] = True
        if state == ACCEPT:
            m[EOS] = True
        _masks[state] = m
    return _masks[state]


def describe_state(state):
    """(kind, field, remaining literal or sub-state, stack) for the figure's labels."""
    seg, sub = state
    kind, lit, field = SEGS[seg]
    # Frames open at this point in the template: the root object after its "{",
    # the "born" object after its "{", and the value being written.
    opened = b"".join((s[1] or b"") for s in SEGS[1:seg] if s[0] == "lit") + (lit[:sub] if kind == "lit" else b"")
    depth = opened.count(b"{") - opened.count(b"}")
    stack = ["root", "born"][:depth]
    if kind == "str":
        stack.append(f"str:{field}")
        detail = {0: "plain", 1: "escape"}.get(sub, "hex" if sub <= 5 else "utf8")
        return {"kind": "str", "field": field, "detail": detail, "stack": stack}
    if kind == "int":
        stack.append(f"int:{field}")
        return {"kind": "int", "field": field, "detail": ["start", "minus", "zero", "digits"][sub], "stack": stack}
    if kind == "lit":
        return {"kind": "lit", "rest": lit[sub:].decode(), "stack": stack}
    if kind == "ws":
        return {"kind": "start", "stack": stack}
    return {"kind": "end", "stack": stack}


# ---------------------------------------------------------------- decoding

PROMPT_IDS = tok(PROMPT, add_special_tokens=False).input_ids


def distribution(gen_ids):
    with torch.no_grad():
        logits = model(torch.tensor([PROMPT_IDS + gen_ids])).logits[0, -1].float()
    return torch.softmax(logits, dim=-1)[:VOCAB]


def text_of(i):
    return "<eos>" if i == EOS else TOKEN_BYTES[i].decode("utf-8", errors="replace")


def decode_step(p, state, use_grammar):
    alive = state is not None
    mask = admissible(state) if alive else torch.zeros(VOCAB, dtype=torch.bool)
    Z = p[mask].sum().item() if alive else 0.0
    if use_grammar:
        pg = torch.where(mask, p, torch.zeros_like(p)) / Z
        choice = int(pg.argmax())
    else:
        choice = int(p.argmax())
    order = torch.argsort(p, descending=True)
    listed = [int(i) for i in order[:TOP]]
    if choice not in listed:
        listed.append(choice)
    if alive:
        extra = [int(i) for i in order[:5000] if mask[int(i)] and int(i) not in listed][:3]
        listed += extra
    rows = [[text_of(i), sig(p[i].item()), int(bool(mask[i])) if alive else -1] for i in listed]
    shown_p = sum(p[i].item() for i in listed)
    shown_a = sum(p[i].item() for i in listed if alive and mask[i])
    rec = {
        "kind": "decode",
        "state": describe_state(state) if alive else None,
        "nAllowed": int(mask.sum()) if alive else None,
        "Z": sig(Z) if alive else None,
        "top": rows,
        "otherAllowed": sig(max(0.0, Z - shown_a)) if alive else None,
        "otherMasked": sig(max(0.0, 1 - shown_p - (Z - shown_a))) if alive else sig(max(0.0, 1 - shown_p)),
        "choice": text_of(choice),
        "p": sig(p[choice].item()),
        "pg": sig(p[choice].item() / Z) if alive and mask[choice] else None,
        "bytes": len(TOKEN_BYTES[choice]) if choice != EOS else 0,
    }
    return choice, rec


def run(mode):
    gen, state, steps, passes = [], START, [], 0
    for _ in range(MAX_STEPS):
        if mode == "jump" and state is not None:
            f = forced(state)
            if f:
                old = gen
                text = tok.decode(gen) + f.decode()
                new = tok(text, add_special_tokens=False).input_ids
                common = 0
                while common < min(len(old), len(new)) and old[common] == new[common]:
                    common += 1
                passes += 1
                steps.append({
                    "kind": "extend", "forced": f.decode(), "tokens": [text_of(i) for i in new[common:]],
                    "recomputed": len(old) - common, "state": describe_state(state), "passes": passes,
                })
                gen = new
                state = consume(state, f)
        p = distribution(gen)
        choice, rec = decode_step(p, state, mode != "free")
        passes += 1
        rec["passes"] = passes
        if state is not None and choice != EOS:
            nxt = consume(state, TOKEN_BYTES[choice])
            rec["violation"] = nxt is None
            state = nxt
        steps.append(rec)
        if choice == EOS:
            break
        gen.append(choice)
    return {"steps": steps, "output": tok.decode(gen), "valid": state == ACCEPT}


runs = {mode: run(mode) for mode in ("free", "mask", "jump")}

print("// Generated by tools/figure-data/constrained-decoding.py; do not edit by hand.")
print("//")
print(f"// Qwen/Qwen2.5-0.5B, revision {REVISION[:7]}, greedy decoding of PROMPT under the")
print("// schema template in the script: free (no grammar), mask (grammar, one decode")
print("// step per token), jump (grammar with jump-forward over forced spans).")
print("// top rows are [token text, p, admissible (1), masked (0), or no parser (-1)].")
print()
print(f'export const SOURCE = "Qwen/Qwen2.5-0.5B, revision {REVISION[:7]}";')
print(f"export const VOCAB = {VOCAB};")
print(f"export const PROMPT = {json.dumps(PROMPT)};")
print("export const TEMPLATE = " + json.dumps('[" "] {"name": "<STR>", "born": {"year": <INT>, "city": "<STR>"}}') + ";")
print()
print("export type Frame = string;")
print("export type ParserState =")
print('  | { kind: "start"; stack: Frame[] }')
print('  | { kind: "lit"; rest: string; stack: Frame[] }')
print('  | { kind: "str"; field: string; detail: string; stack: Frame[] }')
print('  | { kind: "int"; field: string; detail: string; stack: Frame[] }')
print('  | { kind: "end"; stack: Frame[] };')
print("export interface DecodeStep {")
print('  kind: "decode"; state: ParserState | null; nAllowed: number | null; Z: number | null;')
print("  top: Array<[string, number, number]>; otherAllowed: number | null; otherMasked: number;")
print("  choice: string; p: number; pg: number | null; bytes: number; passes: number; violation?: boolean;")
print("}")
print('export interface ExtendStep { kind: "extend"; forced: string; tokens: string[]; recomputed: number; state: ParserState; passes: number }')
print("export type Step = DecodeStep | ExtendStep;")
print("export interface Run { steps: Step[]; output: string; valid: boolean }")
print('export const RUNS: Record<"free" | "mask" | "jump", Run> = {')
for mode, r in runs.items():
    print(f"  {mode}: {{")
    print(f"    output: {json.dumps(r['output'], ensure_ascii=False)},")
    print(f"    valid: {str(r['valid']).lower()},")
    print("    steps: [")
    for st in r["steps"]:
        print("      " + json.dumps(st, ensure_ascii=False) + ",")
    print("    ],")
    print("  },")
print("};")
