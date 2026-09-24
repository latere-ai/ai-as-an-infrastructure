# Regenerate the LINEAGE block of app/src/figures/artifact-lineage.ts: one
# synthetic parent bundle and six derived bundles, with the SHA-256 digest and
# size of every file, the digest of every canonical manifest, and the output
# error of every child against its reference. Prints a TypeScript object
# literal to paste.
#
# The parent is a toy bundle (config.json, tokenizer.json, model.safetensors
# holding one 64 x 64 float32 weight matrix drawn from a seeded heavy-tailed
# distribution). It is not a released model. Each child is written in the
# safetensors layout (8-byte little-endian header length, JSON header padded
# to 8 bytes, tensor bytes) with the transformation recorded in the header
# metadata, as converters do:
#
#   bf16         cast to bfloat16, round to nearest even
#   int4-a       int4 per group of 32 inputs, symmetric, round to nearest,
#                float16 scales, converter 1.4.0
#   int4-b       the same tensors written by converter 1.5.0: only the header
#                metadata differs
#   int4-cal     int4 per group of 32 with a clip ratio per group chosen on a
#                calibration batch (activation-weighted squared error)
#   int4-sr      int4 per group of 32 with stochastic rounding, seed 1; the
#                seed 2 run is recorded to show a second digest
#   lora-merge   parent + (alpha / r) B A, rank 8, merged and cast to bfloat16
#
# Output error is ||X W_child^T - X W_ref^T||_F / ||X W_ref^T||_F on 256
# held-out probe inputs, in float64. W_ref is the parent, except for the merge,
# whose reference is the parent with the adapter applied unmerged in float64.
#
#   python tools/figure-data/artifact-lineage.py      (numpy 2.3.2)

import hashlib
import json
import struct

import numpy as np

D = 64  # hidden size
G = 32  # int4 group size along the input dimension
RANK, ALPHA = 8, 16

rng = np.random.default_rng(20260924)
W = (rng.standard_t(4, size=(D, D)) * 0.125 / np.sqrt(2.0)).astype(np.float32)  # t(4) has variance 2
A = (rng.standard_normal((RANK, D)) / np.sqrt(D)).astype(np.float32)
B = (rng.standard_normal((D, RANK)) * 0.04).astype(np.float32)
X = rng.standard_normal((256, D))  # held-out probe inputs
Xc = rng.standard_normal((128, D)) * np.linspace(0.5, 2.0, D)  # calibration inputs, uneven channel scales

TOKENIZER = b'{"model":"toy-bpe","vocab_size":256}\n'


def canon(obj) -> bytes:
    return (json.dumps(obj, sort_keys=True, separators=(",", ":")) + "\n").encode()


def safetensors(tensors: dict, metadata: dict) -> bytes:
    header, blobs, off = {"__metadata__": metadata}, [], 0
    for name, (dtype, arr) in tensors.items():
        raw = arr.tobytes()
        header[name] = {"dtype": dtype, "shape": list(arr.shape), "data_offsets": [off, off + len(raw)]}
        blobs.append(raw)
        off += len(raw)
    h = json.dumps(header, sort_keys=True, separators=(",", ":")).encode()
    h += b" " * (-len(h) % 8)
    return struct.pack("<Q", len(h)) + h + b"".join(blobs)


def bf16_bits(x: np.ndarray) -> np.ndarray:
    u = x.astype(np.float32).view(np.uint32).astype(np.uint64)
    u = (u + 0x7FFF + ((u >> 16) & 1)) >> 16  # round to nearest even
    return u.astype(np.uint16)


def from_bf16(bits: np.ndarray) -> np.ndarray:
    return (bits.astype(np.uint32) << 16).view(np.float32)


def pack4(q: np.ndarray) -> np.ndarray:
    n = (q.astype(np.int8) & 0x0F).astype(np.uint8)
    return (n[:, 0::2] | (n[:, 1::2] << 4)).astype(np.uint8)


def int4(w: np.ndarray, clip=None, stochastic_seed=None):
    g = w.reshape(D, D // G, G)
    ratio = np.ones((D, D // G)) if clip is None else clip
    scale = (np.abs(g).max(axis=2) * ratio / 7.0).astype(np.float16)
    s = scale.astype(np.float32)[..., None]
    if stochastic_seed is None:
        q = np.round(g / s)
    else:
        u = np.random.default_rng(stochastic_seed).random(g.shape)
        q = np.floor(g / s + u)
    q = np.clip(q, -8, 7)
    deq = (q * s).reshape(D, D).astype(np.float32)
    return q.reshape(D, D), scale, deq


def calibrated_clip(w: np.ndarray) -> np.ndarray:
    # Per group, the clip ratio that minimizes the activation-weighted squared
    # weight error sum_j E[x_j^2] (w_j - q_j)^2 on the calibration batch.
    m2 = (Xc**2).mean(axis=0).reshape(D // G, G)
    best = np.ones((D, D // G))
    for r in range(D):
        for k in range(D // G):
            wg = w[r, k * G:(k + 1) * G]
            errs = []
            for c in np.arange(1.0, 0.64, -0.05):
                sc = np.float32(np.float16(np.abs(wg).max() * c / 7.0))
                qq = np.clip(np.round(wg / sc), -8, 7) * sc
                errs.append((float(((wg - qq) ** 2 * m2[k]).sum()), c))
            best[r, k] = min(errs)[1]
    return best


def rel_err(w: np.ndarray, ref: np.ndarray) -> float:
    y, y0 = X @ w.astype(np.float64).T, X @ ref.T
    return float(np.linalg.norm(y - y0) / np.linalg.norm(y0))


def bundle(config: dict, weights: bytes):
    files = {"config.json": ("config", "application/json", canon(config)),
             "model.safetensors": ("weights", "safetensors", weights),
             "tokenizer.json": ("tokenizer", "application/json", TOKENIZER)}
    desc = [{"path": p, "role": r, "media": m, "size": len(b), "sha256": hashlib.sha256(b).hexdigest()}
            for p, (r, m, b) in sorted(files.items())]
    manifest = canon({"files": desc, "schema": "manifest/1"})
    return {"files": desc, "manifest": hashlib.sha256(manifest).hexdigest()}


base_cfg = {"dtype": "float32", "hidden_size": D, "model_type": "toy"}
parent = bundle(base_cfg, safetensors({"w": ("F32", W)}, {"format": "pt"}))
ref_merge = W.astype(np.float64) + (ALPHA / RANK) * (B.astype(np.float64) @ A.astype(np.float64))

out = {}

bits = bf16_bits(W)
out["bf16"] = (bundle({**base_cfg, "dtype": "bfloat16"}, safetensors({"w": ("BF16", bits)}, {"converter": "cast 1.0.0", "source": parent["manifest"]})),
               rel_err(from_bf16(bits), W.astype(np.float64)), None)

q, sc, deq = int4(W)
q4 = {"w.q4": ("U8", pack4(q)), "w.scale": ("F16", sc)}
qcfg = {**base_cfg, "dtype": "int4", "quantization": {"group_size": G, "rounding": "nearest", "scheme": "symmetric"}}
for key, conv in (("int4-a", "converter 1.4.0"), ("int4-b", "converter 1.5.0")):
    out[key] = (bundle(qcfg, safetensors(q4, {"converter": conv, "source": parent["manifest"]})), rel_err(deq, W.astype(np.float64)), None)

clip = calibrated_clip(W)
q, sc, deq = int4(W, clip=clip)
out["int4-cal"] = (bundle({**qcfg, "quantization": {**qcfg["quantization"], "clip": "calibrated"}},
                          safetensors({"w.q4": ("U8", pack4(q)), "w.scale": ("F16", sc)}, {"converter": "converter 1.4.0", "calibration": "128 samples", "source": parent["manifest"]})),
                   rel_err(deq, W.astype(np.float64)), None)

sr = {}
for seed in (1, 2):
    q, sc, deq = int4(W, stochastic_seed=seed)
    b = bundle({**qcfg, "quantization": {**qcfg["quantization"], "rounding": "stochastic"}},
               safetensors({"w.q4": ("U8", pack4(q)), "w.scale": ("F16", sc)}, {"converter": "converter 1.4.0", "seed": str(seed), "source": parent["manifest"]}))
    sr[seed] = (b, rel_err(deq, W.astype(np.float64)))
out["int4-sr"] = (sr[1][0], sr[1][1], {"manifest": sr[2][0]["manifest"], "error": sr[2][1]})

mbits = bf16_bits(ref_merge.astype(np.float32))
out["lora-merge"] = (bundle({**base_cfg, "dtype": "bfloat16"}, safetensors({"w": ("BF16", mbits)}, {"adapter": "rank 8, alpha 16", "converter": "merge 1.0.0", "source": parent["manifest"]})),
                     rel_err(from_bf16(mbits), ref_merge), {"vsParent": rel_err(from_bf16(mbits), W.astype(np.float64))})


def ts_files(files):
    return "[" + ", ".join(f'{{ path: "{f["path"]}", role: "{f["role"]}", media: "{f["media"]}", size: {f["size"]}, sha256: "{f["sha256"]}" }}' for f in files) + "]"


print("const LINEAGE: Lineage = {")
print(f'  parent: {{ manifest: "{parent["manifest"]}", files: {ts_files(parent["files"])} }},')
print("  children: {")
for key, (b, err, extra) in out.items():
    ex = ""
    if extra and "manifest" in extra:
        ex = f', rerun: {{ seed: 2, manifest: "{extra["manifest"]}", error: {extra["error"]:.5g} }}'
    if extra and "vsParent" in extra:
        ex = f', vsParent: {extra["vsParent"]:.5g}'
    print(f'    "{key}": {{ manifest: "{b["manifest"]}", error: {err:.5g}{ex}, files: {ts_files(b["files"])} }},')
print("  },")
print("};")
