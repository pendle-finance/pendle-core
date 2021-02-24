'''input
'''
import mathv2
import math_alpha
import random
from decimal import *
import math

getcontext().prec = 25
PRECISION_BITS = 40
RONE = 1 << PRECISION_BITS
LIM_POW = Decimal(2**256 - 1).ln()

cnt_v2 = cnt_alpha = 0
sum_diff = Decimal(0)


def doCal(base, exp):
    global sum_diff, cnt_v2, cnt_alpha
    rbase = Decimal(base) / Decimal(RONE)
    rexp = Decimal(exp) / Decimal(RONE)

    if (rbase.ln() * rexp > LIM_POW):
        return

    correct_res = Decimal(int(pow(rbase, rexp) * RONE))
    if (correct_res == 0):
        return

    res_v2 = Decimal(mathv2.rpow(base, exp))
    diff_v2 = abs(correct_res - res_v2)

    res_alpha = Decimal(math_alpha.rpow(base, exp))
    diff_alpha = abs(correct_res - res_alpha)

    if (diff_v2 < diff_alpha):
        cnt_v2 += 1  # v2's result is better
    else:
        cnt_alpha += 1  # alpha's result is better

    sum_diff += diff_v2 / correct_res
    # if (diff_v2 != 0):
    # print(correct_res / diff_v2, diff_v2)
    # check if precision error is significant or not
    if (diff_v2 >= 5 and correct_res / diff_v2 < 10**8):
        print(correct_res, res_v2)
        print("%.10f %.10f" % (rbase, rexp))
        print(base, exp)
        print(correct_res / diff_v2)
        assert(False)

    # print testcases
    # if (random.randint(1, 3) == 1):
    #     print("[\"%d\",\"%d\",\"%d\"]," % (base, exp, int(correct_res)))


num_test = 0
for i in range(20, 120, 4):
    for j in range(40, 48):  # x ^ 100 at most
        for test in range(20):
            base = random.randint(2**i, 2**(i + 1) - 1)
            exp = random.randint(2**j, 2**(j + 1) - 1)
            doCal(base, exp)
            num_test += 1

print("%.10f" % sum_diff)
print("cnt_v2: %d cnt_alpha: %d" % (cnt_v2, cnt_alpha))
