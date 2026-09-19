# -*- coding: utf-8 -*-
"""Just enough linear algebra, in pure Python.

numpy is not available in the build environment, so this implements the two
things the trainer actually needs: a randomized truncated eigendecomposition of
a large sparse symmetric matrix, and a Jacobi eigensolver for the small dense
matrix that falls out of it.
"""
import math
import random


def orthonormalize(cols):
    """Modified Gram-Schmidt, in place. cols is a list of equal-length lists."""
    out = []
    for v in cols:
        for u in out:
            d = 0.0
            for i, ui in enumerate(u):
                d += ui * v[i]
            if d:
                for i in range(len(v)):
                    v[i] -= d * u[i]
        n = math.sqrt(sum(x * x for x in v))
        if n > 1e-9:
            inv = 1.0 / n
            for i in range(len(v)):
                v[i] *= inv
            out.append(v)
    return out


def sym_mul(rows, cols):
    """rows: {i: [(j, w), ...]} sparse symmetric. cols: list of n-vectors.
    Returns M @ each column."""
    k = len(cols)
    n = len(cols[0])
    out = [[0.0] * n for _ in range(k)]
    for i, pairs in rows.items():
        acc = [0.0] * k
        for j, w in pairs:
            for t in range(k):
                acc[t] += w * cols[t][j]
        for t in range(k):
            out[t][i] = acc[t]
    return out


def jacobi(A, sweeps=60):
    """Eigendecomposition of a small dense symmetric matrix.
    Returns (eigenvalues, eigenvectors-as-columns)."""
    n = len(A)
    a = [row[:] for row in A]
    v = [[1.0 if i == j else 0.0 for j in range(n)] for i in range(n)]
    for _ in range(sweeps):
        off = 0.0
        for p in range(n - 1):
            for q in range(p + 1, n):
                off += a[p][q] * a[p][q]
        if off < 1e-18:
            break
        for p in range(n - 1):
            for q in range(p + 1, n):
                if abs(a[p][q]) < 1e-14:
                    continue
                theta = (a[q][q] - a[p][p]) / (2.0 * a[p][q])
                t = (1.0 if theta >= 0 else -1.0) / (abs(theta) + math.sqrt(theta * theta + 1.0))
                c = 1.0 / math.sqrt(t * t + 1.0)
                s = t * c
                for r in range(n):
                    arp, arq = a[r][p], a[r][q]
                    a[r][p] = c * arp - s * arq
                    a[r][q] = s * arp + c * arq
                for r in range(n):
                    apr, aqr = a[p][r], a[q][r]
                    a[p][r] = c * apr - s * aqr
                    a[q][r] = s * apr + c * aqr
                for r in range(n):
                    vrp, vrq = v[r][p], v[r][q]
                    v[r][p] = c * vrp - s * vrq
                    v[r][q] = s * vrp + c * vrq
    vals = [a[i][i] for i in range(n)]
    return vals, v


def randomized_eig(rows, n, k, power=2, seed=7):
    """Top-k eigenpairs of a sparse symmetric matrix by randomized projection.

    rows maps row index -> [(col, weight), ...]. Returns (values, vectors) where
    vectors is a list of k length-n lists, largest |eigenvalue| first.
    """
    rnd = random.Random(seed)
    over = min(n, k + 12)
    Q = [[rnd.gauss(0.0, 1.0) for _ in range(n)] for _ in range(over)]
    Q = orthonormalize(Q)
    for _ in range(power + 1):
        Q = orthonormalize(sym_mul(rows, Q))
        if not Q:
            break
    m = len(Q)
    MQ = sym_mul(rows, Q)
    T = [[0.0] * m for _ in range(m)]
    for p in range(m):
        qp = Q[p]
        for q in range(p, m):
            mq = MQ[q]
            s = 0.0
            for i in range(n):
                s += qp[i] * mq[i]
            T[p][q] = T[q][p] = s
    vals, W = jacobi(T)
    order = sorted(range(m), key=lambda i: -abs(vals[i]))[:k]
    vecs = []
    outvals = []
    for idx in order:
        col = [0.0] * n
        for p in range(m):
            w = W[p][idx]
            if w == 0.0:
                continue
            qp = Q[p]
            for i in range(n):
                col[i] += w * qp[i]
        vecs.append(col)
        outvals.append(vals[idx])
    return outvals, vecs
