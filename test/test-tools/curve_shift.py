'''
This is a small python program to calculate the weight of the market at any given point in time

CNT_SEG is the number of segments that the duration of the market divided into
for example, if CNT_SEG=180 and duration of the market is 6 months, then each segment will be 1 day

alpha[i] is the current state of the curve at the ith segment
=> if CNT_SEG=180, duration = 6 months then alpha[179] will be the curve 1 day before expiry

To use: only change CNT_SEG and DAY to your need
'''
import math

CNT_SEG = 6 * 30 * 24


### DO NOT TOUCH THIS PART ###
PRECISION_BITS = 40
RONE = 1 << PRECISION_BITS
R_arr = [math.log(3.14 * (1 - t * 1.0 / CNT_SEG) + 1) / math.log(3.14 * (1 - (t * 1.0 - 1) / CNT_SEG) + 1) for t in range(1, CNT_SEG + 1)]
alpha = [0]


def cal_dp():
    alpha[0] = 0.5
    for i in range(1, CNT_SEG + 1):
        alpha.append(alpha[i - 1] - eps(i - 1))


def beta(i):
    return 1 - alpha[i]


def eps(i):
    return alpha[i] * beta(i) * (1 - R(i)) / (R(i) * alpha[i] + beta(i))


def R(i):
    return R_arr[i]


cal_dp()
### DO NOT TOUCH THIS PART ###
if __name__ == "__main__":
    DAY = CNT_SEG // 2
    res = alpha[DAY]
    print("%11f %11f" % (RONE - (res * RONE), (res * RONE)))
