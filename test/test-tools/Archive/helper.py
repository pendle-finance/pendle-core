PRECISION_BITS = 40
ONE = 1 << PRECISION_BITS


def fpart(value):
    # This gets the fractional part but strips the sign
    return abs(value) % ONE


def toInt(value):
    return value // ONE


def bit(x, y):
    return (((x >> y) & 1) > 0)


def toFP(ipart):
    return int(ipart * 10**50 * ONE // 10**50)


def abs(value):
    if (value > 0):
        return value
    else:
        return -value


def rsignSub(x, y):
    if (x >= y):
        return (x - y, False)
    else:
        return (y - x, True)
