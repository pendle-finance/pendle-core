'''input
'''
from decimal import *
import math

getcontext().prec = 50
PRECISION_BITS = 40
RONE = 1 << PRECISION_BITS


def calInAmount(Bin, Win, Bout, Wout, outAmount):
    res = Bin * (pow((Bout / (Bout - outAmount)), Wout / Win) - 1)
    return res


def calOutAmount(Bin, Win, Bout, Wout, inAmount):
    res = Bout * (1 - pow((Bin / (Bin + inAmount)), Win / Wout))
    return res

Bin = Decimal(1221374790)
Win = Decimal(562036853)
Bout = Decimal(992558510)
Wout = Decimal(1098949590922)
inAmount = Decimal(800000000)
outAmount = Decimal(255709)

print(calInAmount(Bin, Win, Bout, Wout, outAmount), calOutAmount(Bin, Win, Bout, Wout, inAmount))
