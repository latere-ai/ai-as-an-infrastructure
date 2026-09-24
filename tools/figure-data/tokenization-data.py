# Regenerate the measured data behind the tokenization chapter's figures:
#
#   app/src/figures/data/tokenizer-pipeline.ts   (tokenizer-pipeline figure)
#   app/src/figures/data/vocabulary-sweep.ts     (vocabulary-tradeoff figure)
#   app/src/figures/data/token-premium.ts        (token-premium figure)
#   app/src/figures/data/unigram-lattice.ts      (unigram-lattice figure)
#
# Every count comes from a published tokenizer run on fixed text:
#
# - tokenizer-pipeline: seven fixed strings through three Hugging Face
#   tokenizer.json artifacts (Qwen2.5, Llama 2, XLM-R) with the `tokenizers`
#   library, once with the declared normalizer and once with it removed, and
#   once with literal control-token text parsed as control ids (the library
#   default) and once encoded as ordinary text (`encode_special_tokens`).
# - vocabulary-sweep: FLORES-200 devtest English and Simplified Chinese
#   (1,012 parallel sentences each), tokenized by five byte-level BPE merge
#   tables cut at their first V ranks. A tiktoken Encoding built from the
#   ranks below V applies exactly those merges with the same pretokenizer
#   regex; at full size it reproduces the published tokenizer's counts (the
#   script asserts this against the Hugging Face tokenizer where one exists).
#   Model presets are parameter counts from the Hugging Face safetensors
#   metadata and config.json at the pinned revisions.
# - token-premium: the token premium p = |T(s_l)| / |T(s_en)| of every
#   FLORES-200 devtest item for 16 languages against English, per tokenizer,
#   summarized as quantiles; plus the per-token byte widths of one item for
#   the figure's token strips. Counts exclude automatically inserted special
#   tokens (add_special_tokens=False).
# - unigram-lattice: every piece of XLM-R's Unigram vocabulary that spells a
#   substring of four fixed words (after the ▁ word-start marker), with its
#   published log probability: the edges of each word's segmentation lattice.
#
# FLORES-200: NLLB Team et al., "No Language Left Behind" (2022),
# CC BY-SA 4.0, https://dl.fbaipublicfiles.com/nllb/flores200_dataset.tar.gz
# (sha256 below). Llama and Gemma tokenizers are read from the ungated
# unsloth mirrors, which carry the same tokenizer.json as the gated repos.
#
#   pip install tiktoken tokenizers huggingface_hub
#   (run with tiktoken 0.14.0, tokenizers 0.23.2, huggingface_hub 1.32.0)
#   python tools/figure-data/tokenization-data.py [cache-dir]

import difflib
import hashlib
import json
import statistics
import sys
import tarfile
import urllib.request
from pathlib import Path

import tiktoken
from huggingface_hub import hf_hub_download
from tokenizers import Tokenizer, normalizers

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "app" / "src" / "figures" / "data"
CACHE = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / ".cache" / "aaai-figure-data")

FLORES_URL = "https://dl.fbaipublicfiles.com/nllb/flores200_dataset.tar.gz"
FLORES_SHA256 = "b8b0b76783024b85797e5cc75064eb83fc5288b41e9654dabc7be6ae944011f6"

HF = {
    "qwen25": ("Qwen/Qwen2.5-0.5B", "060db6499f32faf8b98477b0a26969ef7d8b9987"),
    "llama2": ("NousResearch/Llama-2-7b-hf", "8efe6c9b93655b934e27bd9981e3ec13e55aee9d"),
    "llama3": ("unsloth/Llama-3.2-1B", "9535bd9b1d1dea6acafbdc4813b728796aeb28da"),
    "deepseek3": ("deepseek-ai/DeepSeek-V3", "e815299b0bcbac849fa540c768ef21845365c9eb"),
    "xlmr": ("FacebookAI/xlm-roberta-base", "e73636d4f797dec63c3081bb6ed5c7b0bb3f2089"),
    "gemma3": ("unsloth/gemma-3-1b-pt", "34a98bf3eaecc08c699516f625eb5e56e4c5d99d"),
}
TIKTOKEN = {"gpt2": "gpt2", "cl100k": "cl100k_base", "o200k": "o200k_base"}


def hf_path(key):
    repo, rev = HF[key]
    return hf_hub_download(repo, "tokenizer.json", revision=rev)


def hf_tokenizer(key):
    return Tokenizer.from_file(hf_path(key))


# GPT-2's reversible byte-to-character map, used by byte-level BPE vocabularies.
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


B2U = byte_decoder()


def flores():
    CACHE.mkdir(parents=True, exist_ok=True)
    tar = CACHE / "flores200_dataset.tar.gz"
    if not tar.exists():
        urllib.request.urlretrieve(FLORES_URL, tar)
    digest = hashlib.sha256(tar.read_bytes()).hexdigest()
    assert digest == FLORES_SHA256, f"FLORES-200 archive digest {digest}"
    root = CACHE / "flores200_dataset"
    if not root.exists():
        with tarfile.open(tar) as t:
            t.extractall(CACHE, filter="data")
    return lambda code: (root / "devtest" / f"{code}.devtest").read_text(encoding="utf-8").splitlines()


def ts(v):
    return json.dumps(v, ensure_ascii=False, separators=(",", ":"))


# ---------------------------------------------------------------- pipeline

SAMPLES = [
    ("compat", "\ufb01le \uff27\uff30\uff35 \uff12\uff14\uff27\uff22"),
    ("combining", "Cafe\u0301 na\u00efve"),
    ("chinese", "小猫坐在垫子上，它很累。"),
    ("emoji", "\U0001F469\u200d\U0001F4BB ok \U0001F40D"),
    ("code", "    if x:\n\treturn 1"),
    ("digits", "Pay 12345.67 in 2024"),
    ("control", "Stop at </s> or <|endoftext|>"),
]
PIPE_TOKENIZERS = ["xlmr", "llama2", "qwen25"]

# Token kinds in the pipeline records.
ORDINARY, CONTROL_FROM_TEXT, INSERTED, BYTE_PIECE, UNKNOWN = 0, 1, 2, 3, 4


def piece_display(key, tok_str):
    """What a piece spells, with bytes that are not a whole character in ⟨hex⟩."""
    if key == "qwen25":
        raw = bytes(B2U[c] for c in tok_str)
    elif tok_str.startswith("<0x") and tok_str.endswith(">") and len(tok_str) == 6:
        return f"⟨{tok_str[3:5]}⟩", True
    else:
        return tok_str, False
    out, i, partial = "", 0, False
    while i < len(raw):
        for n in (4, 3, 2, 1):
            try:
                out += raw[i:i + n].decode("utf-8")
                i += n
                break
            except UnicodeDecodeError:
                continue
        else:
            j = i
            while j < len(raw):
                try:
                    raw[j:].decode("utf-8")
                    break
                except UnicodeDecodeError:
                    j += 1
            bad = raw[i:max(j, i + 1)]
            out += "⟨" + " ".join(f"{b:02X}" for b in bad) + "⟩"
            i += len(bad)
            partial = True
    return out, partial


def raw_piece(key, tok_str, unknown_text=None):
    """The bytes a piece spells (an unknown piece: the text it replaced)."""
    if unknown_text is not None:
        return unknown_text.encode("utf-8")
    if key == "qwen25":
        return bytes(B2U[c] for c in tok_str)
    if tok_str.startswith("<0x") and tok_str.endswith(">") and len(tok_str) == 6:
        return bytes([int(tok_str[3:5], 16)])
    return tok_str.encode("utf-8")


def diff_flags(a, b):
    """Per-character change flags of a and b ("1" changed) from a code-point alignment."""
    fa, fb = ["0"] * len(a), ["0"] * len(b)
    for op, i1, i2, j1, j2 in difflib.SequenceMatcher(None, a, b, autojunk=False).get_opcodes():
        if op != "equal":
            for i in range(i1, i2):
                fa[i] = "1"
            for j in range(j1, j2):
                fb[j] = "1"
    return "".join(fa), "".join(fb)


def pipeline():
    out = {}
    summary = []
    for key in PIPE_TOKENIZERS:
        base = hf_tokenizer(key)
        specials = {t.content for t in base.get_added_tokens_decoder().values() if t.special}
        declared = base.normalizer
        prepends = key == "llama2"  # Prepend("▁") + Replace(" ", "▁"), undone by the decoder
        out[key] = {}
        for skey, x in SAMPLES:
            rec = {}
            for norm in (1, 0):
                for parse in (1, 0):
                    tok = hf_tokenizer(key)
                    if not norm:
                        tok.normalizer = normalizers.Sequence([])
                    tok.encode_special_tokens = not parse
                    n = declared.normalize_str(x) if (norm and declared) else x
                    e = tok.encode(x)
                    toks, pre_raw = [], []
                    for t, i, (s0, s1), w, m in zip(e.tokens, e.ids, e.offsets, e.word_ids, e.special_tokens_mask):
                        if m:
                            kind, shown = INSERTED, t
                        elif t in specials and parse and i == tok.token_to_id(t):
                            kind, shown = CONTROL_FROM_TEXT, t
                        elif i == tok.token_to_id("<unk>") and tok.token_to_id("<unk>") is not None:
                            kind, shown = UNKNOWN, "<unk>"
                        else:
                            shown, partial = piece_display(key, t)
                            kind = BYTE_PIECE if partial else ORDINARY
                        toks.append([shown, i, s0, s1, -1 if w is None else w, kind])
                        if w is not None:
                            raw = raw_piece(key, t, x[s0:s1] if kind == UNKNOWN else None)
                            while len(pre_raw) <= w:
                                pre_raw.append(b"")
                            pre_raw[w] += raw
                    dec = tok.decode([i for i, m in zip(e.ids, e.special_tokens_mask) if not m], skip_special_tokens=False)
                    n_view = n.replace("▁", " ")
                    if prepends and norm and n_view.startswith(" "):
                        n_view = n_view[1:]
                    xf, nf = diff_flags(x, n)
                    _, df = diff_flags(x, dec)
                    rec[f"{norm}{parse}"] = {"n": n, "p": [r.decode("utf-8") for r in pre_raw], "t": toks, "d": dec, "xf": xf, "nf": nf, "df": df, "eqX": dec == x, "eqN": dec == n_view}
                    summary.append(f"{key:7s} {skey:9s} norm={norm} parse={parse} tokens={len(toks):2d} eqX={dec == x!s:5s} eqN={dec == n_view!s:5s} dec={dec!r}")
            out[key][skey] = rec
    print("\n".join(summary))
    meta = {k: {"repo": HF[k][0], "rev": HF[k][1]} for k in PIPE_TOKENIZERS}
    body = [
        "// Generated by tools/figure-data/tokenization-data.py; do not edit by hand.",
        "//",
        "// Seven fixed strings through three published tokenizer.json artifacts with",
        "// the Hugging Face `tokenizers` library (0.23.2): Qwen2.5 (byte-level BPE,",
        "// NFC), Llama 2 (SentencePiece BPE with byte fallback), and XLM-R",
        "// (SentencePiece Unigram with an NFKC-based normalizer). RECORDS[tokenizer]",
        "// [sample][`${norm}${parse}`]: norm 1 applies the declared normalizer and 0",
        "// removes it; parse 1 turns literal control-token text into control ids (the",
        "// library default) and 0 encodes it as ordinary text. Each record holds N(x)",
        "// (n), the pretokens the boundary rules produced (p, one per word index), the",
        "// tokens as [piece, id, start, end, word, kind] with offsets into x",
        "// and kind 0 ordinary, 1 control id parsed from text, 2 inserted by the",
        "// post-processor, 3 piece that is not a whole character (bytes in ⟨hex⟩),",
        "// 4 unknown; the decoded text d = Decode(Encode(x)) without the inserted ids;",
        "// per-character change flags of x against N(x) (xf, nf) and of the decoded",
        "// text against x (df); and whether d equals x and N(x) (for Llama 2, N(x) with",
        "// ▁ read as a space and the prepended ▁ dropped, as its decoder does).",
        "",
        f"export const SAMPLES = {ts([{'key': k, 'text': v} for k, v in SAMPLES])} as const;",
        f"export const SOURCES = {ts(meta)} as const;",
        "",
        "export type PipeToken = [piece: string, id: number, start: number, end: number, word: number, kind: number];",
        "export interface PipeRecord { n: string; p: string[]; t: PipeToken[]; d: string; xf: string; nf: string; df: string; eqX: boolean; eqN: boolean }",
        "",
        "export const RECORDS: Record<string, Record<string, Record<string, PipeRecord>>> = " + ts(out) + ";",
        "",
    ]
    (OUT / "tokenizer-pipeline.ts").write_text("\n".join(body), encoding="utf-8")


# ---------------------------------------------------------------- sweep

def rank_table(key):
    """(ranks, pattern, check tokenizer) of a byte-level BPE merge table."""
    if key in TIKTOKEN:
        e = tiktoken.get_encoding(TIKTOKEN[key])
        return dict(e._mergeable_ranks), e._pat_str, None
    j = json.loads(Path(hf_path(key)).read_text(encoding="utf-8"))
    pat = j["pre_tokenizer"]["pretokenizers"][0]["pattern"]["Regex"]
    ranks = {bytes(B2U[c] for c in s): i for s, i in j["model"]["vocab"].items()}
    return ranks, pat, hf_tokenizer(key)


def encoding(name, ranks, pat, below):
    return tiktoken.Encoding(name, pat_str=pat, mergeable_ranks={b: r for b, r in ranks.items() if r < below}, special_tokens={})


SWEEP_FAMILIES = [
    ("gpt2", "GPT-2", 50257),
    ("cl100k", "GPT-4 (cl100k)", 100277),
    ("llama3", "Llama 3", 128256),
    ("qwen25", "Qwen2.5", 151665),
    ("o200k", "GPT-4o (o200k)", 200019),
]

# Embedding rows (config vocab_size, padded past the tokenizer for some
# models), width, tying, and total parameters from safetensors metadata.
MODELS = [
    ("qwen25_05b", "Qwen2.5-0.5B", "Qwen/Qwen2.5-0.5B", "060db6499f32faf8b98477b0a26969ef7d8b9987", 151936, 896, True, 494032768),
    ("gemma3_1b", "Gemma 3 1B", "unsloth/gemma-3-1b-pt", "34a98bf3eaecc08c699516f625eb5e56e4c5d99d", 262144, 1152, True, 999885952),
    ("llama32_1b", "Llama 3.2 1B", "unsloth/Llama-3.2-1B", "9535bd9b1d1dea6acafbdc4813b728796aeb28da", 128256, 2048, True, 1235814400),
    ("llama31_8b", "Llama 3.1 8B", "unsloth/Meta-Llama-3.1-8B", "e9a141a2091ea561b96483212645a2a05e6f99fc", 128256, 4096, False, 8030261248),
    ("llama31_70b", "Llama 3.1 70B", "unsloth/Meta-Llama-3.1-70B", "1b7306651142d0cc65d993076a250a6a82cf046c", 128256, 8192, False, 70553706496),
]


def model_presets():
    from huggingface_hub import model_info
    rows = []
    for key, name, repo, rev, rows_v, d, tied, total in MODELS:
        info = model_info(repo, revision=rev, expand=["safetensors", "sha"])
        cfg = json.loads(Path(hf_hub_download(repo, "config.json", revision=rev)).read_text())
        c = cfg.get("text_config", cfg)
        assert c["vocab_size"] == rows_v and c["hidden_size"] == d, (repo, c["vocab_size"], c["hidden_size"])
        assert info.safetensors.total == total, (repo, info.safetensors.total)
        rows.append({"key": key, "name": name, "repo": repo, "rev": rev, "rows": rows_v, "d": d, "tied": tied, "total": total})
    return rows


def sweep(read):
    texts = {"en": read("eng_Latn"), "zh": read("zho_Hans")}
    nbytes = {k: sum(len(s.encode("utf-8")) for s in v) for k, v in texts.items()}
    grid = sorted({round(256 * 2 ** (k / 8)) for k in range(0, 81)})
    out = {}
    cl_ranks = None
    for key, _, _ in SWEEP_FAMILIES:
        ranks, pat, check = rank_table(key)
        size = len(ranks)
        if key == "cl100k":
            cl_ranks = ranks
        full = encoding(key, ranks, pat, size)
        if check is not None:
            for lang, lines in texts.items():
                a = sum(len(x) for x in full.encode_ordinary_batch(lines))
                b = sum(len(check.encode(s, add_special_tokens=False).ids) for s in lines)
                assert a == b, (key, lang, a, b)
        start = 256
        if key == "llama3":
            # Llama 3 keeps cl100k's 100,256 ranks and appends 27,744 more.
            assert all(cl_ranks.get(b) == r for b, r in ranks.items() if r < len(cl_ranks))
            start = len(cl_ranks)
        vs = [v for v in grid if start <= v < size] + [size]
        if key == "llama3":
            vs = [start] + [v for v in vs if v > start]
        rows = {"v": vs}
        for lang, lines in texts.items():
            rows[lang] = []
            for v in vs:
                n = sum(len(x) for x in encoding(f"{key}{v}", ranks, pat, v).encode_ordinary_batch(lines))
                rows[lang].append(round(1000 * n / nbytes[lang], 1))
        out[key] = rows
        print(key, size, rows["v"][-1], rows["en"][-1], rows["zh"][-1])
    fams = [{"key": k, "name": n, "size": s, "ranks": out[k]["v"][-1]} for k, n, s in SWEEP_FAMILIES]
    body = [
        "// Generated by tools/figure-data/tokenization-data.py; do not edit by hand.",
        "//",
        "// SWEEP: tokens per 1,000 UTF-8 bytes of FLORES-200 devtest English (en) and",
        "// Simplified Chinese (zh), 1,012 parallel sentences each, for five published",
        "// byte-level BPE merge tables cut at their first V ranks (v, every eighth of",
        "// an octave from 256, and the full size). A cut table",
        "// applies only the merges ranked below V, with the tokenizer's own",
        "// pretokenizer regex; at full size the counts equal the published",
        "// tokenizer's. Sources: tiktoken 0.14.0 gpt2, cl100k_base, o200k_base;",
        f"// Qwen2.5 {HF['qwen25'][0]}@{HF['qwen25'][1][:10]}; Llama 3 {HF['llama3'][0]}@{HF['llama3'][1][:10]}.",
        "// Llama 3's first 100,256 ranks are cl100k's (checked), so its row starts",
        "// there. `size` counts special tokens too; `ranks` is the mergeable ranks.",
        "//",
        "// MODELS: embedding rows (config vocab_size), width d, weight tying, and total",
        "// parameters (safetensors metadata) of published checkpoints at the revisions",
        "// named.",
        "",
        f"export const FAMILIES = {ts(fams)} as const;",
        "",
        "export const SWEEP: Record<string, { v: number[]; en: number[]; zh: number[] }> = " + ts(out) + ";",
        "",
        f"export const MODELS = {ts(model_presets())} as const;",
        "",
    ]
    (OUT / "vocabulary-sweep.ts").write_text("\n".join(body), encoding="utf-8")


# ---------------------------------------------------------------- premium

PREMIUM_TOKENIZERS = [
    ("llama2", "Llama 2", 32000),
    ("gpt2", "GPT-2", 50257),
    ("cl100k", "GPT-4 (cl100k)", 100277),
    ("llama3", "Llama 3", 128256),
    ("deepseek3", "DeepSeek-V3", 128815),
    ("qwen25", "Qwen2.5", 151665),
    ("o200k", "GPT-4o (o200k)", 200019),
    ("xlmr", "XLM-R", 250002),
    ("gemma3", "Gemma 3", 262145),
]
LANGS = [
    ("deu_Latn", "German", "德语"),
    ("rus_Cyrl", "Russian", "俄语"),
    ("ell_Grek", "Greek", "希腊语"),
    ("vie_Latn", "Vietnamese", "越南语"),
    ("swh_Latn", "Swahili", "斯瓦希里语"),
    ("zho_Hans", "Chinese", "中文"),
    ("jpn_Jpan", "Japanese", "日语"),
    ("kor_Hang", "Korean", "韩语"),
    ("arb_Arab", "Arabic", "阿拉伯语"),
    ("hin_Deva", "Hindi", "印地语"),
    ("ben_Beng", "Bengali", "孟加拉语"),
    ("tam_Taml", "Tamil", "泰米尔语"),
    ("tha_Thai", "Thai", "泰语"),
    ("amh_Ethi", "Amharic", "阿姆哈拉语"),
    ("mya_Mymr", "Burmese", "缅甸语"),
    ("shn_Mymr", "Shan", "掸语"),
]
ITEM = 555  # zero-based devtest line: "Ancient cultures and tribes began to keep them ..."
WIDTH_CHARS = "0123456789abcdefghijklmnopqrstuvwxyz"
PARTIAL_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def piece_bytes(key, tok, ids, text):
    """(byte width, whole characters?) of each piece of one encoded text."""
    if key in TIKTOKEN:
        parts = [tok.decode_single_token_bytes(i) for i in ids]
    else:
        strs = [tok.id_to_token(i) for i in ids]
        if key in ("qwen25", "llama3", "deepseek3"):
            parts = [bytes(B2U[c] for c in s) for s in strs]
        else:
            parts = []
            for s in strs:
                if s.startswith("<0x") and s.endswith(">") and len(s) == 6:
                    parts.append(bytes([int(s[3:5], 16)]))
                elif s == "<unk>":
                    parts.append(b"?")
                else:
                    parts.append(s.replace("▁", " ").encode("utf-8"))
    out = []
    for b in parts:
        try:
            b.decode("utf-8")
            whole = True
        except UnicodeDecodeError:
            whole = False
        out.append((max(1, len(b)), whole))
    return out


def strip_code(widths):
    return "".join(WIDTH_CHARS[min(w, 35)] if whole else PARTIAL_CHARS[min(w, 26) - 1] for w, whole in widths)


def premium(read):
    codes = ["eng_Latn"] + [c for c, _, _ in LANGS]
    text = {c: read(c) for c in codes}
    for c in codes:
        assert len(text[c]) == 1012, c
    quant, counts, strips, unk = {}, {}, {}, {}
    for key, _, _ in PREMIUM_TOKENIZERS:
        if key in TIKTOKEN:
            tok = tiktoken.get_encoding(TIKTOKEN[key])
            enc = lambda s, tok=tok: tok.encode_ordinary(s)
        else:
            tok = hf_tokenizer(key)
            enc = lambda s, tok=tok: tok.encode(s, add_special_tokens=False).ids
        unk_id = None if key in TIKTOKEN else tok.token_to_id("<unk>")
        n = {c: [enc(s) for s in text[c]] for c in codes}
        ref = [len(x) for x in n["eng_Latn"]]
        quant[key], counts[key], strips[key] = {}, {}, {}
        unk[key] = {c: sum(x.count(unk_id) for x in n[c]) if unk_id is not None else 0 for c in codes}
        for c in codes:
            lens = [len(x) for x in n[c]]
            if c != "eng_Latn":
                p = sorted(a / b for a, b in zip(lens, ref))
                q = statistics.quantiles(p, n=20, method="inclusive")  # 5 % steps
                quant[key][c] = [round(q[0], 3), round(q[4], 3), round(statistics.median(p), 3), round(q[14], 3), round(q[18], 3), round(sum(lens) / sum(ref), 3)]
            counts[key][c] = len(n[c][ITEM])
            strips[key][c] = strip_code(piece_bytes(key, tok, n[c][ITEM], text[c][ITEM]))
        print(key, {c: quant[key][c][2] for c in codes[1:]}, "unk", {c: v for c, v in unk[key].items() if v})
    item_bytes = {c: len(text[c][ITEM].encode("utf-8")) for c in codes}
    body = [
        "// Generated by tools/figure-data/tokenization-data.py; do not edit by hand.",
        "//",
        "// Token premium p_{l,i} = |T(s_{l,i})| / |T(s_{en,i})| over the 1,012 parallel",
        "// items of FLORES-200 devtest (NLLB Team et al., 2022; CC BY-SA 4.0), for 16",
        "// languages against English, per published tokenizer. QUANTILES[tokenizer]",
        "// [language] = [p5, p25, p50, p75, p95, ratio of summed token counts]. Counts",
        "// exclude automatically inserted special tokens. Tokenizers: tiktoken 0.14.0",
        "// (gpt2, cl100k_base, o200k_base) and Hugging Face tokenizer.json at the",
        "// revisions in SOURCES, via tokenizers 0.23.2.",
        "//",
        f"// ITEM {ITEM} (zero-based devtest line) is shown as token strips: ITEM_COUNTS",
        "// holds its token count per tokenizer and language, ITEM_BYTES its UTF-8",
        "// length, and STRIPS one character per piece, the piece's byte width in",
        "// base 36 (0-9a-z) when it spells whole characters and as a capital letter",
        "// (A = 1 byte) when it holds only part of a character.",
        "",
        f"export const TOKENIZERS = {ts([{'key': k, 'name': nm, 'size': s} for k, nm, s in PREMIUM_TOKENIZERS])} as const;",
        f"export const LANGS = {ts([{'code': c, 'en': e, 'zh': z} for c, e, z in LANGS])} as const;",
        f"export const SOURCES = {ts({k: {'repo': HF[k][0], 'rev': HF[k][1]} for k, _, _ in PREMIUM_TOKENIZERS if k in HF})} as const;",
        f"export const ITEM = {ITEM};",
        "",
        "export const QUANTILES: Record<string, Record<string, number[]>> = " + ts(quant) + ";",
        "export const ITEM_COUNTS: Record<string, Record<string, number>> = " + ts(counts) + ";",
        f"export const ITEM_BYTES: Record<string, number> = {ts(item_bytes)};",
        "// UNKNOWN: <unk> tokens emitted over all 1,012 items, where any.",
        "export const UNKNOWN: Record<string, Record<string, number>> = " + ts({k: {c: v for c, v in d.items() if v} for k, d in unk.items()}) + ";",
        "export const STRIPS: Record<string, Record<string, string>> = " + ts(strips) + ";",
        "",
    ]
    (OUT / "token-premium.ts").write_text("\n".join(body), encoding="utf-8")


# ---------------------------------------------------------------- unigram

LATTICE_WORDS = ["lowest", "unbelievable", "tokenization", "小猫坐在垫子上"]


def unigram():
    j = json.loads(Path(hf_path("xlmr")).read_text(encoding="utf-8"))
    assert isinstance(j["model"]["vocab"], list)  # a Unigram model: [piece, log p] pairs
    vocab = {piece: score for piece, score in j["model"]["vocab"]}
    tok = hf_tokenizer("xlmr")
    out = []
    for word in LATTICE_WORDS:
        w = "▁" + word
        edges = [[i, k, w[i:k], round(vocab[w[i:k]], 4)] for i in range(len(w)) for k in range(i + 1, len(w) + 1) if w[i:k] in vocab]
        # Every character must be a piece, so every word has a segmentation.
        assert all(any(e[0] == i and e[1] == i + 1 for e in edges) for i in range(len(w))), word
        # The highest-probability path (Viterbi) must be what the library emits.
        best = [(0.0, [])] + [(-1e18, [])] * len(w)
        for k in range(1, len(w) + 1):
            for i, k2, piece, lp in edges:
                if k2 == k and best[i][0] + lp > best[k][0]:
                    best[k] = (best[i][0] + lp, best[i][1] + [piece])
        assert best[-1][1] == tok.encode(word, add_special_tokens=False).tokens, (word, best[-1][1])
        out.append({"word": word, "text": w, "edges": edges})
        print(word, len(edges), "edges")
    body = [
        "// Generated by tools/figure-data/tokenization-data.py; do not edit by hand.",
        "//",
        "// Segmentation lattices from XLM-R's published SentencePiece Unigram model",
        f"// ({HF['xlmr'][0]}@{HF['xlmr'][1][:10]}, 250,002 pieces). For each word, after",
        "// the ▁ word-start marker, every vocabulary piece that spells a substring,",
        "// as [start, end, piece, log p] with the model's own log probability.",
        "",
        "export const WORDS: ReadonlyArray<{ word: string; text: string; edges: ReadonlyArray<readonly [number, number, string, number]> }> = " + ts(out) + ";",
        "",
    ]
    (OUT / "unigram-lattice.ts").write_text("\n".join(body), encoding="utf-8")


if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    read = flores()
    pipeline()
    sweep(read)
    premium(read)
    unigram()
