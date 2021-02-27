'''input
'''
TOTAL_LP = 10**18
SWAP_FEE = 0.0035
PRECISION_BITS = 40
RONE = 1 << PRECISION_BITS


def removeLiq(raw_Wout, inAmountLp, Bout):
    global TOTAL_LP
    Wout = raw_Wout / RONE
    outAmountToken = Bout * (1 - (1 - inAmountLp / TOTAL_LP)**(1 / Wout)) * (1 - (1 - Wout) * SWAP_FEE)
    TOTAL_LP -= inAmountLp
    return int(outAmountToken)


def addLiq(raw_Win, Bin, inAmount):
    global TOTAL_LP
    Win = raw_Win / RONE
    outAmountLp = TOTAL_LP * ((1 + inAmount * (1 - (1 - Win) * SWAP_FEE) / Bin)**Win - 1)
    TOTAL_LP += outAmountLp
    return int(outAmountLp)


ORIGINAL = TOTAL_LP
print(removeLiq(660606624369, ORIGINAL * 1 / 100, 2133 * 10**6))
print(removeLiq(436996733543, ORIGINAL * 99 / 100, 4231 * 10**6))
