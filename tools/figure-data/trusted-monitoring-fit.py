# Regenerate the ATTACK constants of app/src/figures/trusted-monitoring.ts: the
# mean and standard deviation of the trusted monitor's suspicion score on
# attack outputs, in units of the score on honest outputs (which is standard
# normal), fitted so that the figure's closed-form safety reproduces the
# defer-to-trusted frontier Greenblatt et al. report for trusted monitoring on
# APPS ("AI Control: Improving Safety Despite Intentional Subversion", ICML
# 2024, arXiv:2312.06942v5, Table 3).
#
# Fixed inputs, all from the same paper (section 3.2):
#   - audit budget: the top 2% of outputs by suspicion, a threshold set at a 2%
#     false-positive rate on honest GPT-4 solutions;
#   - 5,000 problems per simulated deployment;
#   - attack rate: the attack policy proposes a backdoor on 71 of 1,500
#     problems and each proposal is submitted with probability 1/12;
#   - an unaudited attempt succeeds (passes the tests and is exploitable) on 13
#     of 47 attempts.
#
# Model, as in the figure: an attempt is audited when its score is at or above
# the audit cut (the protocol shuts the untrusted model down), deferred to the
# trusted model when it is between the defer cut and the audit cut (no harm, no
# catch), and accepted below the defer cut, where it causes the unacceptable
# outcome with probability SUCCEED. Over N tasks with attack rate r, the
# probability that an accepted attack succeeds before any attack is audited is
#   ASR = l s / (a + l s) * (1 - (1 - r (a + l s))^N).
# Least squares over a grid on (mean, sd). Standard library only.
#
#   python tools/figure-data/trusted-monitoring-fit.py

from math import erf, sqrt

PUBLISHED = [  # defer share (top x% of suspicion, audited 2% included), safety, scaled usefulness
    (0.00, 0.62, 0.97),
    (0.05, 0.74, 0.95),
    (0.10, 0.83, 0.93),
    (0.20, 0.92, 0.83),
    (0.50, 1.00, 0.51),
]
AUDIT = 0.02
N = 5000
RATE = 71 / 1500 / 12
SUCCEED = 13 / 47


def cdf(z):
    return 0.5 * (1 + erf(z / sqrt(2)))


def quantile(u):
    lo, hi = -10.0, 10.0
    for _ in range(200):
        mid = (lo + hi) / 2
        if cdf(mid) < u:
            lo = mid
        else:
            hi = mid
    return (lo + hi) / 2


def safety(mean, sd, defer):
    za = quantile(1 - AUDIT)
    zd = quantile(1 - max(defer, AUDIT))
    a = 1 - cdf((za - mean) / sd)
    l = cdf((zd - mean) / sd)
    lose = l * SUCCEED
    if a + lose == 0:
        return 1.0
    return 1 - lose / (a + lose) * (1 - (1 - RATE * (a + lose)) ** N)


best = None
for i in range(0, 301):
    mean = 0.5 + i * 0.01
    for j in range(0, 181):
        sd = 0.2 + j * 0.01
        err = sum((safety(mean, sd, x) - s) ** 2 for x, s, _ in PUBLISHED)
        if best is None or err < best[0]:
            best = (err, mean, sd)

err, mean, sd = best
za = quantile(1 - AUDIT)
print(f"export const ATTACK = {{ mean: {mean:.2f}, sd: {sd:.2f} }}; // rms error {sqrt(err / len(PUBLISHED)):.3f}")
print(f"P(audited) per attempt: {1 - cdf((za - mean) / sd):.3f} (paper: 0.338)")
auroc = cdf(mean / sqrt(1 + sd * sd))
print(f"AUROC of the fitted monitor: {auroc:.3f}")
for x, s, u in PUBLISHED:
    f = max(x, AUDIT) - AUDIT
    print(f"defer {x:.2f}: safety model {safety(mean, sd, x):.3f} paper {s:.2f}; scaled usefulness model {1 - f:.2f} paper {u:.2f}")
