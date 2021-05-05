'''input
'''
from decimal import *
import math
from curve_shift import CNT_SEG, alpha, RONE

getcontext().prec = 25

swapFee = Decimal(0)
swapFee = Decimal(0.0035)
afterSwapFee = Decimal(1) - swapFee


def calInAmount(Bin, Win, Bout, Wout, outAmount):
    res = Bin * (pow((Bout / (Bout - outAmount)), Wout / Win) - 1)
    res = Bin / afterSwapFee
    return res

def calOutAmount(Bin, Win, Bout, Wout, inAmount):
    inAmount = inAmount * afterSwapFee
    res = Bout * (1 - pow((Bin / (Bin + inAmount)), Win / Wout))
    return res

def getWeight(T):
    res = alpha[T//3600]
    return (Decimal(RONE - (res * RONE)), Decimal((res * RONE)))

def calOutWeight(T, Bin, Bout, inAmount, xytInput=True):
    Win, Wout = getWeight(T)
    inAmount = inAmount * afterSwapFee
    if xytInput:
        Wout, Win = getWeight(T)
        temp = Bin
        Bin = Bout
        Bout = temp
    res = Bout * (1 - pow((Bin / (Bin + inAmount)), Win / Wout))
    return res

def calInWeight(T, Bin, Bout, outAmount, xytInput=False):
    Win, Wout = getWeight(T)
    if xytInput:
        Wout, Win = getWeight(T)
    res = Bin * (pow((Bout / (Bout - outAmount)), Wout / Win) - 1)
    res = res / afterSwapFee
    return res  

Bin = Decimal(1000000000)
Win = Decimal(549789788090)
Bout = Decimal(1000000000)
Wout = Decimal(549721839686)
inAmount = Decimal(20405615)
outAmount = Decimal(20000000)

Bin = Bin + Decimal(20405615 + 20405615 + 14832741 - 13851215 - 11713770)
Bout = Bout + Decimal(-19931395 - 19162864 -13498154 + 12731281 + 11241212)

print(
    calOutWeight(
        900000, 
        Bin, 
        Bout, 
        Decimal(112411212), 
        False
    )
)
