# To add a new cell, type '# %%'
# To add a new markdown cell, type '# %% [markdown]'
# %%
# This is another approach to calculate the actual protocol fees for treasury
# Let say we are swapping (inAmount) xyt to get tokens.

# The protocol will keep (inAmount * swapFee) for itself and swapping (inAmount * (1 - swapFee)) to token for user. swapFee is usually 0.35%

# 80% of the above-mentioned fee will stay and enlarge the market, while the other 20% should go to treasury
# This test aims to "make sure" that treasury is receiving only 20% of the fee, by using another approach (other than simulating K-param in contract implementation).

# The idea is to converting the treasury fee into real amount of assets (inAmount * swapFee * 20%), and try to "addLiquiditySingle" that amount into market (without swapfee, of course) to see how much LP outcome should be.

# Usage:
# There are only 3 functions to use: swapXytToToken, swapTokenToXyt and addLiquidityDual. They all take 2 arguments to run (Timestamp, amount). 
# For two swapping functions, they will automatically simulate the paramK in the contract and using the above approach to compare the LP gained by the treasury.


# %%
from decimal import *
import math
from curve_shift import CNT_SEG, alpha, RONE


# %%
getcontext().prec = 25

swapFee = Decimal(0)
swapFee = Decimal(0.0035)
afterSwapFee = Decimal(1) - swapFee
protocolFee = Decimal(0.2)
totalSupply = Decimal(0)
MINIMUM_LIQUIDITY = 10**3


# %%
def getWeight(T):
    res = alpha[T//3600]
    return (Decimal(RONE - (res * RONE)), Decimal((res * RONE)))

def getRawWeight(T):
    res = alpha[T//3600]
    return (Decimal(1-res), Decimal(res))


# %%
################ K STUFF #################################
kLast = -1
totalTreasury = 0

def calcK(T):
    Win, Wout = getRawWeight(T)
    global Bin, Bout
    return round(pow(Bin, Win) * pow(Bout, Wout))

def updateK(T):
    global kLast
    kNow = calcK(T)
    kLast = kNow

def updateTreasury(T):
    global kLast, totalSupply, totalTreasury
    kNow = calcK(T)
    if kNow > kLast:
        numer = totalSupply * (kNow - kLast)
        denom = (1 - protocolFee) * kNow / protocolFee + kLast

        gainedLp = numer / denom
        totalTreasury += gainedLp
        totalSupply += gainedLp
        updateK(T)
        return gainedLp
    updateK(T)

#######################################################

def calRightProtocolLP(Bin, Bout, Win, Wout, constsSwapAmount):
    actual_swap_fee = constsSwapAmount * swapFee
    actual_protocol_fee = actual_swap_fee * protocolFee
    tempBin = Bin + constsSwapAmount - actual_protocol_fee
    tempBout = Bout - calOutWeight(Bin, Bout, Win, Wout, constsSwapAmount)
    t = (tempBin + actual_protocol_fee) / tempBin
    outLp = (pow(tempBin, Win) * pow(tempBout, Wout)) * (pow(t, Win) - 1)
    return outLp

def updateBalance(da, db):    
    global Bin, Bout
    Bin = Bin + da
    Bout = Bout + db

def calOutWeight(Bin, Bout, Win, Wout, inAmount):
    oldInAmount = inAmount
    inAmount = inAmount * afterSwapFee
    res = Bout * (1 - pow((Bin / (Bin + inAmount)), Win / Wout))
    return res



### SWAPPING FUNCTIONS
def swapTokenToXyt(T, inAmount):
    print("\n==================SWAPPING===================")
    global Bin, Bout
    
    Win, Wout = getRawWeight(T)

    alter = calRightProtocolLP(Bin, Bout, Win, Wout, inAmount)
    print("LP alter:", alter)

    updateK(T)
    outAmount = calOutWeight(Bin, Bout, Win, Wout, inAmount)
    updateBalance(inAmount, -outAmount)
    actualLp = updateTreasury(T)

    if actualLp is None:
        return

    print("Actual LP:", actualLp)
    print('')
    print("Difference:", abs(actualLp - alter))
    print("Difference / totalSupply", abs(actualLp - alter)/totalSupply)

    print("============================================\n")


def swapXytToToken(T, inAmount):
    print("\n==================SWAPPING===================")
    global Bin, Bout

    Win, Wout = getRawWeight(T)

    alter = calRightProtocolLP(Bout, Bin, Wout, Win, inAmount)
    print("LP alter:", alter)

    updateK(T)
    outAmount = calOutWeight(Bout, Bin, Wout, Win, inAmount)
    updateBalance(-outAmount, inAmount)
    actualLp = updateTreasury(T)

    if actualLp is None:
        return

    print("Actual LP:", actualLp)
    print('')
    print("Difference:", abs(actualLp - alter))
    print("Difference / totalSupply", abs(actualLp - alter)/totalSupply)

    print("============================================\n")

def addLiquidityDual(T, amount):
    x = amount
    y = amount
    global Bin, Bout, totalSupply
    if Bin < Bout:
        x = amount * Bin / Bout
    else:
        y = amount * Bout / Bin
    Bin += x
    Bout += y
    totalSupply += totalSupply * x / Bin
    updateK(T)


# %%
def run_swap(time, swapTime):
    for i in range(swapTime):
        global Bin, Bout
        amount = Decimal(40000000 + 5000000 * i)
        if i % 3 == 0:
            calOutWeight(time, Bin, Bout, amount, False)
        else:
            calOutWeight(time, Bin, Bout, amount, True)
        addLiquidityDual(amount)


# %%
Bin = Decimal(10000000000)
Bout = Decimal(10000000000)

constsSwapAmount = Decimal(1500500 * 15)


totalSupply = Decimal.sqrt(Bin * Bout)

T = 3600 
swapTokenToXyt(T, constsSwapAmount)
swapXytToToken(T, constsSwapAmount)
addLiquidityDual(T, constsSwapAmount)


T = 3600 * 10
swapTokenToXyt(T, constsSwapAmount * 2)
swapXytToToken(T, constsSwapAmount * 3)
addLiquidityDual(T, constsSwapAmount * 4)


T = 3600 * 100
swapTokenToXyt(T, constsSwapAmount * 5)
swapXytToToken(T, constsSwapAmount * 6)
addLiquidityDual(T, constsSwapAmount * 7)


T = 3600 * 300
swapTokenToXyt(T, constsSwapAmount * 8)
swapXytToToken(T, constsSwapAmount * 9)
addLiquidityDual(T, constsSwapAmount * 10)


T = 3600 * 500
swapTokenToXyt(T, constsSwapAmount * 11)
swapXytToToken(T, constsSwapAmount * 12)
addLiquidityDual(T, constsSwapAmount * 13)




