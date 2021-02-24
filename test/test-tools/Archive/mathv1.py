'''
Python version of Pendle's V1 Math Lib
'''

import helper

PRECISION_BITS = 40
ONE = 1 << PRECISION_BITS
PRECISION_POW = 100


def rmul(x, y):
    return ((ONE // 2 + (x) * (y)) >> PRECISION_BITS)


def rdiv(x, y):
    return (y // 2 + x * ONE) // (y)


def countLeadingZeros(_p, _q):
    denomator = (1 << 255)
    cnt = 0
    for i in range(255, -1, -1):
        if (_p // (_q * denomator) > 0):
            assert(i == countv2(_p, _q))
            return i
        cnt += 1
        denomator = denomator // 2
    return -1


def log2ForSmallNumber(_x):
    res = 0
    one = ONE
    two = 2 * one
    addition = one
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
        n = countLeadingZeros(_p, _q)

    y = (_p * ONE) // (_q * (1 << n))
    log2Small = log2ForSmallNumber(y)
    return n * ONE + log2Small


def ln(p, q=ONE):
    ln2Numerator = 6931471805599453094172
    ln2Denomerator = 10000000000000000000000

    log2x = logBase2(p, q)

    return (ln2Numerator * log2x) // ln2Denomerator


def rpowi(_x, _n):
    z = ONE
    if (_n % 2 != 0):
        z = _x
    _n //= 2
    while(_n != 0):
        _x = rmul(_x, _x)
        if (_n % 2 != 0):
            z = rmul(z, _x)
        _n //= 2

    return z


def rfloor(x):
    return rtoi(x) * ONE


def rtoi(x):
    return x // ONE


def rpow(_base, _exp):
    whole = rfloor(_exp)
    remain = _exp - whole
    wholePow = rpowi(_base, rtoi(whole))
    if (remain == 0):
        return wholePow
    partialResult = rpowApprox(_base, remain)
    return rmul(wholePow, partialResult)


def rpowApprox(_base, _exp):
    a = _exp
    (x, xneg) = helper.rsignSub(_base, ONE)
    term = ONE
    sum = term
    negative = False

    i = 0
    while(term >= PRECISION_POW):
        i = i + 1
        bigK = i * ONE
        (c, cneg) = helper.rsignSub(a, bigK - ONE)
        term = rmul(term, rmul(c, x))
        term = rdiv(term, bigK)
        if (term == 0):
            break
        if (xneg):
            negative = ~negative
        if (cneg):
            negative = ~negative
        if (negative):
            assert(sum >= term)
            sum = sum - term
        else:
            sum = sum + term
    print("converge:", i)
    return sum
