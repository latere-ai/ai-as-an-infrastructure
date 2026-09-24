# Regenerate the data blocks of app/src/figures/superposition-toy.ts (GRID)
# and app/src/figures/sae-readback.ts (TOY and SAES).
#
# Part 1, the toy model of superposition (Elhage et al. 2022, "Toy Models of
# Superposition"): m = 5 features, d = 2 hidden dimensions. Each feature
# coefficient a_i is 0 with probability S and uniform on [0, 1] otherwise,
# independently. The model writes h = V a (the columns v_i of V are the feature
# directions), reads back a_hat = ReLU(V^T h + b), and minimizes
#
#   L = E[ sum_i I_i (a_i - a_hat_i)^2 ],   I_i = r^(i-1).
#
# The expectation is taken exactly over how many features are active (0 to 5)
# and by sampling within each count, so very sparse settings are not starved
# of active examples. For each grid point (1 - S on a 1/10-decade grid from 1
# to 0.01, r in {0.9, 0.8, 0.7}), 16 random starts and one start from the
# previous (denser) grid point's solution are trained with Adam for 6000 full
# steps and the run with the lowest held-out loss is kept (runs within 0.1% of
# the zero-readback loss of the best are ties, resolved toward the previous
# grid point so the drawing does not reshuffle between neighbors). The loss is
# invariant to a rotation or reflection of the hidden plane, so each kept
# solution is rotated to put v_1 on the +x axis and reflected to put v_2 in the
# upper half plane; neighboring grid points then draw in the same frame.
#
# Part 2, a TopK sparse autoencoder (the chapter's formulation, with ReLU after
# TopK as in Gao et al. 2024) fit to the hidden activations h of the toy model
# at r = 0.9 and 1 - S = 0.1 (inputs with at least one active feature), with
# unit-norm decoder columns, for dictionary widths {3, 5, 8}, k in {1, 2}, and
# seeds {1, 2, 3}.
#
#   python tools/figure-data/superposition-toy.py   (numpy 2.3; about 8 min)
#
# Prints the TypeScript literals to paste into the two modules.

import numpy as np
from math import comb

N, D = 5, 2
DENSITIES = [round(10 ** (-e / 10), 6) for e in range(21)]  # 1 ... 0.01
RATIOS = [0.9, 0.8, 0.7]
SEEDS, STEPS, BATCH, LR = 16, 6000, 256, 0.02
TIE = 0.001  # loss differences below 0.1% of the zero-readback loss count as ties


def strata(S):
    """P(exactly j of the N features are active), j = 0..N, per run."""
    p = 1 - S
    return np.stack([comb(N, j) * p ** j * S ** (N - j) for j in range(N + 1)], axis=-1)


def batch(rng, B):
    """B samples for each active count j = 1..N (a random j-subset with uniform
    values), flattened to (N * B, N), and the count index of each row."""
    xs = []
    for j in range(1, N + 1):
        idx = np.argsort(rng.random((B, N)), axis=1)[:, :j]
        mask = np.zeros((B, N))
        np.put_along_axis(mask, idx, 1.0, axis=1)
        xs.append(mask * rng.random((B, N)))
    return np.concatenate(xs), np.repeat(np.arange(1, N + 1), B)


def forward(V, b, X):
    H = X @ V.transpose(0, 2, 1)  # (R, rows, D): h = V a
    Z = H @ V + b[:, None, :]  # (R, rows, N): V^T h + b
    return H, Z


def toy_train(S, I, seed, V0=None, b0=None):
    """Train one run per row of S (R,) and I (R, N) from a random start, or from
    V0, b0 where given (rows of V0 that are NaN start at random); returns
    V (R, D, N), b (R, N)."""
    rng = np.random.default_rng(seed)
    R = len(S)
    P = strata(S)  # (R, N + 1)
    V = rng.normal(0, 0.5 / np.sqrt(D), (R, D, N))
    b = np.zeros((R, N))
    if V0 is not None:
        warm = ~np.isnan(V0[:, 0, 0])
        V[warm], b[warm] = V0[warm], b0[warm]
    mV, vV, mb, vb = (np.zeros_like(V), np.zeros_like(V), np.zeros_like(b), np.zeros_like(b))
    for t in range(1, STEPS + 1):
        X, j = batch(rng, BATCH)
        wt = P[:, j] / BATCH  # (R, rows): each row stands for its count's probability mass
        H, Z = forward(V, b, X)
        G = 2 * (np.maximum(Z, 0) - X[None]) * (Z > 0) * I[:, None, :] * wt[:, :, None]  # dL/dZ
        gb = G.sum(axis=1) + 2 * np.maximum(b, 0) * I * P[:, :1]  # plus the all-zero input
        gV = H.transpose(0, 2, 1) @ G + (G @ V.transpose(0, 2, 1)).transpose(0, 2, 1) @ X
        lr = LR * 0.1 ** (t / STEPS)
        for p, g, m, v in ((V, gV, mV, vV), (b, gb, mb, vb)):
            m *= 0.9
            m += 0.1 * g
            v *= 0.999
            v += 0.001 * g * g
            p -= lr * (m / (1 - 0.9 ** t)) / (np.sqrt(v / (1 - 0.999 ** t)) + 1e-8)
    return V, b


def toy_loss(V, b, S, I, B=20000, seed=123):
    X, j = batch(np.random.default_rng(seed), B)
    _, Z = forward(V, b, X)
    P = strata(S)
    per = ((np.maximum(Z, 0) - X[None]) ** 2 * I[:, None, :]).sum(-1)  # (R, rows)
    L = (per * P[:, j] / B).sum(-1) + P[:, 0] * (np.maximum(b, 0) ** 2 * I).sum(-1)
    base = (1 - S) / 3 * I.sum(-1)  # loss of reading back zero for every feature
    return L, base


def canonical(V):
    a = np.arctan2(V[1, 0], V[0, 0])
    c, s = np.cos(-a), np.sin(-a)
    V = np.array([[c, -s], [s, c]]) @ V
    if V[1, 1] < 0:
        V = V * np.array([[1], [-1]])
    return V


def fmt(v, digits=3):
    s = f"{v:.{digits}f}".rstrip("0").rstrip(".")
    return "0" if s in ("-0", "") else s


def align(X, P):
    """X rotated or reflected to best match P (2-D orthogonal Procrustes), and the residual."""
    U, _, Vt = np.linalg.svd(P @ X.T)
    Y = U @ Vt @ X
    return Y, np.linalg.norm(Y - P)


def superposition_grid():
    """Sweep 1 - S from dense to sparse. At every grid point each ratio gets
    SEEDS random starts plus one start from the previous grid point's kept
    solution, so an arrangement persists while it stays optimal."""
    out = {r: [] for r in RATIOS}
    kept = {r: None for r in RATIOS}  # (V, b) kept at the previous grid point
    runs = SEEDS + 1
    for step, dens in enumerate(DENSITIES):
        S = np.full(len(RATIOS) * runs, 1 - dens)
        I = np.repeat([r ** np.arange(N) for r in RATIOS], runs, axis=0)
        V0 = np.full((len(RATIOS) * runs, D, N), np.nan)
        b0 = np.zeros((len(RATIOS) * runs, N))
        for q, r in enumerate(RATIOS):
            if kept[r] is not None:
                V0[q * runs + SEEDS], b0[q * runs + SEEDS] = kept[r]
        V, b = toy_train(S, I, seed=step, V0=V0, b0=b0)
        L, base = toy_loss(V, b, S, I)
        for q, r in enumerate(RATIOS):
            rows = np.arange(q * runs, (q + 1) * runs)
            rel = L[rows] / base[rows]
            # Runs within TIE of the best are equally good solutions (typically
            # the same polygon with the features on other vertices); among them
            # keep the one closest to the previous grid point.
            ties = rows[rel <= rel.min() + TIE]
            prev = None if kept[r] is None else canonical(kept[r][0])
            k = ties[np.argmin(rel[ties - rows[0]])] if prev is None else min(ties, key=lambda t: align(V[t], prev)[1])
            kept[r] = (V[k].copy(), b[k].copy())
            out[r].append({"dens": dens, "V": canonical(V[k]), "b": b[k], "loss": L[k] / base[k],
                           "ties": len(ties), "warm": k == rows[-1] and prev is not None})
    return out


def topk_relu(z, k):
    idx = np.argsort(-z, axis=1)[:, :k]
    f = np.zeros_like(z)
    np.put_along_axis(f, idx, np.take_along_axis(z, idx, axis=1), axis=1)
    return np.maximum(f, 0)


def sample_h(rng, V, dens, n):
    """Hidden activations h = V a for inputs with at least one active feature."""
    A = (rng.random((n, N)) < dens) * rng.random((n, N))
    A = A[(A > 0).any(axis=1)]
    return A @ V.T


def sae_train(X, m, k, seed, steps=3000, lr=0.01, B=512):
    rng = np.random.default_rng(seed)
    Wd = rng.normal(size=(D, m))
    Wd /= np.linalg.norm(Wd, axis=0)
    We, be, bd = Wd.T.copy(), np.zeros(m), np.zeros(D)
    params = [We, be, Wd, bd]
    ms = [np.zeros_like(p) for p in params]
    vs = [np.zeros_like(p) for p in params]
    for t in range(1, steps + 1):
        xb = X[rng.integers(0, len(X), B)]
        xc = xb - bd
        f = topk_relu(xc @ We.T + be, k)
        g = 2 * (f @ Wd.T + bd - xb) / B
        gz = (g @ Wd) * (f > 0)
        gWd = g.T @ f
        gWd -= (gWd * Wd).sum(0) * Wd  # keep only the part that turns each unit column
        grads = [gz.T @ xc, gz.sum(0), gWd, g.sum(0) - (gz @ We).sum(0)]
        lr_t = lr * 0.1 ** (t / steps)
        for p, gr, mm, vv in zip(params, grads, ms, vs):
            mm *= 0.9
            mm += 0.1 * gr
            vv *= 0.999
            vv += 0.001 * gr * gr
            p -= lr_t * (mm / (1 - 0.9 ** t)) / (np.sqrt(vv / (1 - 0.999 ** t)) + 1e-8)
        Wd /= np.linalg.norm(Wd, axis=0)
    return We, be, Wd, bd


def sae_runs(V, dens):
    Xtr = sample_h(np.random.default_rng(7), V, dens, 100000)
    Xte = sample_h(np.random.default_rng(99), V, dens, 50000)
    Vn = V / np.linalg.norm(V, axis=0)
    runs = {}
    for m in (3, 5, 8):
        for k in (1, 2):
            for seed in (1, 2, 3):
                We, be, Wd, bd = sae_train(Xtr, m, k, seed)
                f = topk_relu((Xte - bd) @ We.T + be, k)
                fvu = ((f @ Wd.T + bd - Xte) ** 2).sum() / ((Xte - Xte.mean(0)) ** 2).sum()
                runs[f"m{m}k{k}s{seed}"] = dict(We=We, be=be, Wd=Wd, bd=bd, fvu=fvu,
                                                freq=(f > 0).mean(0), cos=(Vn.T @ Wd).max(1))
    return runs


def arr(a):
    return "[" + ", ".join(fmt(x) for x in np.ravel(a)) + "]"


if __name__ == "__main__":
    grid = superposition_grid()
    print("// superposition-toy.ts GRID")
    print("const GRID: Record<Ratio, Solution[]> = {")
    for r in RATIOS:
        print(f'  "{r}": [')
        for s in grid[r]:
            print(f'    {{ dens: {fmt(s["dens"], 6)}, vx: {arr(s["V"][0])}, vy: {arr(s["V"][1])}, b: {arr(s["b"])}, loss: {fmt(s["loss"], 4)} }}, // {s["ties"]} of {SEEDS + 1} runs tie{", kept the warm start" if s["warm"] else ""}')
        print("  ],")
    print("};")

    toy = next(s for s in grid[0.9] if abs(s["dens"] - 0.1) < 1e-9)
    runs = sae_runs(toy["V"], 0.1)
    print("\n// sae-readback.ts TOY and SAES")
    print(f'const TOY = {{ dens: 0.1, vx: {arr(toy["V"][0])}, vy: {arr(toy["V"][1])} }};')
    print("const SAES: Record<string, Sae> = {")
    for key, r in runs.items():
        print(f'  {key}: {{ encX: {arr(r["We"][:, 0])}, encY: {arr(r["We"][:, 1])}, benc: {arr(r["be"])}, decX: {arr(r["Wd"][0])}, decY: {arr(r["Wd"][1])}, bdec: {arr(r["bd"])} }}, // FVU {fmt(r["fvu"], 4)}, freq {arr(r["freq"])}, best cos {arr(r["cos"])}')
    print("};")
    print(f"// numpy {np.__version__}")
