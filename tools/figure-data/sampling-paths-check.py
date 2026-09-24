# Independent check of app/src/figures/sampling-paths.ts. The figure computes
# every field in the page, in closed form, for three 2D Gaussian mixtures; this
# script recomputes the same quantities in numpy from the same seeded noise and
# prints them, so the module's readouts can be compared line by line, and it
# verifies the condition that makes the reflow panel exact.
#
#   python tools/figure-data/sampling-paths-check.py   (numpy 2.3)
#
# Paths, with x0 ~ N(0, I) the reference noise and x1 ~ the mixture:
#   diffusion: x_t = a_t x1 + sigma_t x0, cosine schedule a_t^2 = f(t)/f(0),
#              f(t) = cos^2((t + s)/(1 + s) * pi/2), s = 0.008, sigma_t^2 = 1 - a_t^2,
#              sampled from t = 1 to t = 0 along the probability-flow ODE;
#   flow:      x_t = t x1 + (1 - t) x0 with independent pairs, v*(x, t) = E[x1 - x0 | x_t = x];
#   reflow:    pairs (x0, T(x0)), T the flow's ODE map. Its field is the chord
#              velocity T(x0) - x0 when no two chords pass through the same point at
#              the same time, which holds when det((1 - t) I + t DT) > 0 everywhere.
#
# For a mixture with equal component variance s^2, both fields are posterior
# averages over components k with weights r_k(x, t) ∝ w_k N(x; a mu_k, var I):
#   diffusion  dx/dt = da/dt * sum_k r_k [mu_k - a (1 - s^2) (x - a mu_k) / var],
#              var = 1 - a^2 (1 - s^2)   (the PF-ODE f - g^2/2 grad log p_t for VP paths)
#   flow       v*    = sum_k r_k [mu_k + (t s^2 - (1 - t)) (x - t mu_k) / var],
#              var = t^2 s^2 + (1 - t)^2

import numpy as np

S_OFF = 0.008
TH0 = S_OFF / (1 + S_OFF) * np.pi / 2
PARTICLES = 200
REF_STEPS = 96
SWEEP = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32]


def mulberry32(seed):
    a = seed & 0xFFFFFFFF

    def next_u():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF
        t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + (((t ^ (t >> 7)) * (t | 61)) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296

    return next_u


def noise(seed, n):
    u = mulberry32(seed)
    out = np.zeros((n, 2))
    for i in range(n):
        u1, u2 = 1 - u(), u()
        r = np.sqrt(-2 * np.log(u1))
        out[i] = r * np.cos(2 * np.pi * u2), r * np.sin(2 * np.pi * u2)
    return out


def targets():
    ang = np.arange(8) * 2 * np.pi / 8
    th = np.arange(8) * np.pi / 7
    moons = np.r_[np.c_[np.cos(th), np.sin(th)], np.c_[1 - np.cos(th), 0.5 - np.sin(th)]]
    moons = (moons - moons.mean(0)) * 1.8
    return {
        "two": (np.array([[-2.0, 0.0], [2.0, 0.0]]), 0.25),
        "ring": (np.c_[2.5 * np.cos(ang), 2.5 * np.sin(ang)], 0.2),
        "moons": (moons, 0.15),
    }


def cos_a(t):
    th = (t + S_OFF) / (1 + S_OFF) * np.pi / 2
    return np.cos(th) / np.cos(TH0), -np.sin(th) * (np.pi / 2) / (1 + S_OFF) / np.cos(TH0)


def weights(x, mu, a, var):
    d = x[:, None, :] - a * mu[None]
    lr = -(d ** 2).sum(-1) / (2 * var)
    lr -= lr.max(1, keepdims=True)
    r = np.exp(lr)
    return r / r.sum(1, keepdims=True), d


def vel(kind, x, tau, mix):
    """Velocity in sampling progress tau, from noise (0) to data (1)."""
    mu, s = mix
    if kind == "diffusion":
        a, da = cos_a(1 - tau)
        var = 1 - a * a * (1 - s * s)
        r, d = weights(x, mu, a, var)
        vk = da * (mu[None] - a * (1 - s * s) * d / var)
        return -(r[..., None] * vk).sum(1)
    a, sg = tau, 1 - tau
    var = a * a * s * s + sg * sg
    r, d = weights(x, mu, a, var)
    vk = mu[None] + (a * s * s - sg) * d / var
    return (r[..., None] * vk).sum(1)


def rk4(kind, x0, mix, n):
    x, h = x0.copy(), 1 / n
    for k in range(n):
        t = k * h
        k1 = vel(kind, x, t, mix)
        k2 = vel(kind, x + h / 2 * k1, t + h / 2, mix)
        k3 = vel(kind, x + h / 2 * k2, t + h / 2, mix)
        k4 = vel(kind, x + h * k3, t + h, mix)
        x = x + h / 6 * (k1 + 2 * k2 + 2 * k3 + k4)
    return x


def euler(kind, x0, mix, n):
    x = x0.copy()
    for k in range(n):
        x = x + vel(kind, x, k / n, mix) / n
    return x


def on_data(x, mix):
    mu, s = mix
    dmin = np.sqrt(((x[:, None] - mu[None]) ** 2).sum(-1)).min(1)
    return (dmin < 3 * s).mean()


def chord_check(mix):
    """Smallest det((1 - t) I + t DT) over a grid of noise points and t in [0, 1]."""
    g = np.linspace(-3.5, 3.5, 41)
    pts = np.stack(np.meshgrid(g, g), -1).reshape(-1, 2)
    e = 1e-3
    shifted = np.r_[pts + [e, 0], pts - [e, 0], pts + [0, e], pts - [0, e]]
    T = rk4("flow", shifted, mix, 200)
    n = len(pts)
    J = np.zeros((n, 2, 2))
    J[:, :, 0] = (T[:n] - T[n:2 * n]) / (2 * e)
    J[:, :, 1] = (T[2 * n:3 * n] - T[3 * n:]) / (2 * e)
    return min(np.linalg.det((1 - t) * np.eye(2)[None] + t * J).min() for t in np.linspace(0, 1, 51))


def main(seed=7):
    x0 = noise(seed, PARTICLES)
    for name, mix in targets().items():
        print(f"{name}: smallest chord determinant {chord_check(mix):.4f} (> 0: reflow paths are straight)")
        ref = {k: rk4(k, x0, mix, REF_STEPS) for k in ("diffusion", "flow")}
        fine = rk4("flow", x0, mix, 1000)
        print(f"  reference error at {REF_STEPS} RK4 steps: {np.abs(ref['flow'] - fine).max():.2e}")
        print(f"  exact endpoints on the data: diffusion {on_data(ref['diffusion'], mix):.3f}, flow and reflow {on_data(ref['flow'], mix):.3f}")
        for kind in ("diffusion", "flow"):
            rows = []
            for n in SWEEP:
                e = euler(kind, x0, mix, n)
                gap = np.linalg.norm(e - ref[kind], axis=1).mean()
                rows.append(f"N={n}: {on_data(e, mix):.3f} gap {gap:.3f}")
            print(f"  {kind:9s} " + "; ".join(rows))


if __name__ == "__main__":
    main()
