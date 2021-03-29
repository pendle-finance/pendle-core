PRECISION_BITS = 40
RONE = 1 << PRECISION_BITS
SQRT_RONE = 1 << (PRECISION_BITS // 2)
BIG_NUMBER = 1 << 200


def rmul(x, y):
    return ((RONE // 2 + (x) * (y)) >> PRECISION_BITS)


def rdiv(x, y):
    return (y // 2 + x * RONE) // (y)


def log2Int(_p, _q):
    res = 0
    remain = _p // _q
    while(remain > 0):
        res += 1
        remain //= 2
    return res - 1


def log2ForSmallNumber(_x):
    res = 0
    one = (1 << PRECISION_BITS)
    two = 2 * one
    addition = one

    assert((_x >= one) and (_x < two))
    assert(PRECISION_BITS < 125)

    for i in range(PRECISION_BITS, 0, -1):
        _x = (_x * _x) // one
        addition = addition // 2
        if (_x >= two):
            _x = _x // 2
            res += addition

    return res


def logBase2(_p, _q):
    n = 0
    if (_p > _q):
        n = log2Int(_p, _q)

    y = (_p * RONE) // (_q * (1 << n))
    log2Small = log2ForSmallNumber(y)

    assert(n * RONE <= BIG_NUMBER)
    assert(log2Small <= BIG_NUMBER)

    return n * RONE + log2Small

# def ln_new(p, q):
#     log2x = logBase2(p, q)
#     return rdiv(log2x, 1586259972793)


def ln(p, q):
    ln2Numerator = 6931471805599453094172
    ln2Denomerator = 10000000000000000000000

    log2x = logBase2(p, q)
    return (ln2Numerator * log2x) // ln2Denomerator


def fpart(value):
    return abs(value) % RONE


def toInt(value):
    return value // RONE


def toFP(value):
    return int(value * RONE)  # customize to work with float as well


def rpowe(exp):
    res = 0

    curTerm = RONE

    n = 0
    while(True):
        res += curTerm
        curTerm = rmul(curTerm, rdiv(exp, toFP(n + 1)))
        if (curTerm == 0):
            break
        n += 1
        assert(n <= 500)

    # print("converge", n)
    return res


def rpow(base, exp):
    if (exp == 0):
        # Anything to the 0 is 1
        return RONE
    if (base == 0):
        # 0 to anything except 0 is 0
        return 0

    frac = fpart(exp)
    whole = exp - frac

    wholePow = rpowi(base, toInt(whole))

    if (base < RONE):
        newExp = rmul(frac, ln(rdiv(RONE, base), RONE))
        fracPow = rdiv(RONE, rpowe(newExp))
    else:
        newExp = rmul(frac, ln(base, RONE))
        fracPow = rpowe(newExp)
    return rmul(wholePow, fracPow)


def rpowi(base, exp):
    if (exp % 2 != 0):
        res = base
    else:
        res = RONE

    exp //= 2
    while(exp != 0):
        base = rmul(base, base)
        if (exp % 2 != 0):
            res = rmul(res, base)
        exp //= 2
    return res
