"""压力/边界测试：随机数据、序列化、确定性、异常输入。"""

import json
import random
import sys

import numpy as np
import pandas as pd

sys.path.insert(0, "recommendation")
from recommender import build_rating_matrix, compute_item_similarity, recommend

random.seed(42)
np.random.seed(42)

failures: list[str] = []


def check(name: str, cond: bool, detail: str = ""):
    print(f"{'PASS' if cond else 'FAIL'} | {name}" + (f" | {detail}" if detail else ""))
    if not cond:
        failures.append(name)


# --- 1. 随机稀疏数据 60用户x25书 ---
n_users, n_books = 60, 25
uids = [f"u{i:02d}" for i in range(n_users)]
bids = [f"b{i:02d}" for i in range(n_books)]
rows = [
    {"user_id": u, "book_id": b, "value": random.randint(1, 5)}
    for u in uids
    for b in bids
    if random.random() < 0.3
]
ratings = pd.DataFrame(rows)
books = pd.DataFrame({"id": bids, "title": [f"T{b}" for b in bids], "author_id": ["a"] * n_books})
authors = pd.DataFrame({"id": ["a"], "name": ["Au"]})

m = build_rating_matrix(ratings, bids)
sim = compute_item_similarity(m)

check("sim within [-1,1] (eps 1e-9)", bool(sim.values.min() >= -1 - 1e-9 and sim.values.max() <= 1 + 1e-9),
      f"[{sim.values.min():.6f},{sim.values.max():.6f}]")
check("sim no NaN", not bool(sim.isna().any().any()))

bad_scores, leaked, exceptions = 0, 0, 0
for u in uids:
    try:
        res = recommend(u, m, sim, books, authors, top_n=5)
    except Exception as e:  # noqa: BLE001
        exceptions += 1
        print("  exception:", u, e)
        continue
    if res["status"] != "ok":
        continue
    rated = set(m.loc[u].dropna().index)
    for r in res["recommendations"]:
        if not np.isfinite(r["score"]):
            bad_scores += 1
        if r["book_id"] in rated:
            leaked += 1
check("random stress: no exceptions", exceptions == 0)
check("random stress: all scores finite", bad_scores == 0)
check("random stress: no already-rated leak", leaked == 0)

# --- 2. JSON 序列化 (为 API 接入做准备) ---
res = recommend(uids[0], m, sim, books, authors, top_n=3)
try:
    json.dumps(res, ensure_ascii=False)
    ok = True
    detail = "json ok"
except TypeError as e:
    ok = False
    detail = str(e)
check("result JSON-serializable", ok, detail)

# --- 3. 预测分数是否可能越出 [1,5] ---
# 苛刻用户: 评分 {5,5,5,1} (mean=4, max|dev|=3 => pred 可达 7)
harsh = pd.DataFrame(
    [
        {"user_id": "h", "book_id": f"hk{i}", "value": v}
        for i, v in enumerate([5, 5, 5, 1])
    ]
    + [
        {"user_id": "g1", "book_id": f"hk{i}", "value": 5}
        for i in range(4)
    ]
    + [
        {"user_id": "g1", "book_id": "cand1", "value": 5},
        {"user_id": "g2", "book_id": "cand1", "value": 5},
        {"user_id": "g2", "book_id": "hk0", "value": 5},
        {"user_id": "g2", "book_id": "hk1", "value": 5},
        {"user_id": "g2", "book_id": "hk2", "value": 5},
        {"user_id": "g2", "book_id": "hk3", "value": 5},
    ]
)
m2 = build_rating_matrix(harsh, ["cand1", "hk0", "hk1", "hk2", "hk3"])
sim2 = compute_item_similarity(m2)
books2 = pd.DataFrame(
    {"id": ["cand1", "hk0", "hk1", "hk2", "hk3"], "title": ["C", "H0", "H1", "H2", "H3"], "author_id": ["a"] * 5}
)
res2 = recommend("h", m2, sim2, books2, authors, top_n=5)
if res2["status"] == "ok":
    out_of_range = [r for r in res2["recommendations"] if not (1 <= r["score"] <= 5)]
    check("scores within [1,5]", not out_of_range,
          f"scores={[r['score'] for r in res2['recommendations']]}")
else:
    check("scores within [1,5]", True, f"status={res2['status']}")

# --- 4. 只评过1本书的用户: 所有候选同分, 排序是否确定 ---
one = pd.DataFrame(
    [{"user_id": "x0", "book_id": "r1", "value": 4}]  # 目标用户只评过1本
    + [
        {"user_id": f"x{i}", "book_id": b, "value": random.randint(1, 5)}
        for i in range(1, 6)
        for b in ["r1", "c1", "c2", "c3"]
    ]
)
m3 = build_rating_matrix(one, ["r1", "c1", "c2", "c3"])
sim3 = compute_item_similarity(m3)
books3 = pd.DataFrame({"id": ["r1", "c1", "c2", "c3"], "title": ["R", "C1", "C2", "C3"], "author_id": ["a"] * 4})
runs = [recommend("x0", m3, sim3, books3, authors, top_n=3) for _ in range(3)]
orders = [[r["book_id"] for r in run["recommendations"]] for run in runs]
scores = [[r["score"] for r in run["recommendations"]] for run in runs]
check("tie-breaking deterministic across runs", len(set(map(str, orders))) == 1, f"orders={orders}")
check("1-rating user: prediction uniform (documented)", all(
    len(set(s)) == 1 for s in scores if len(s) > 0
), f"scores={scores}")

# --- 5. 真正零方差物品: 每个评分者都恰好在自己均值处评该书 ---
zz = pd.DataFrame(
    [
        {"user_id": "p1", "book_id": "same", "value": 3},
        {"user_id": "p1", "book_id": "a", "value": 2},
        {"user_id": "p1", "book_id": "b", "value": 4},  # p1 mean=3 => same resid=0
        {"user_id": "p2", "book_id": "same", "value": 3},
        {"user_id": "p2", "book_id": "a", "value": 1},
        {"user_id": "p2", "book_id": "b", "value": 5},  # p2 mean=3 => same resid=0
    ]
)
m4 = build_rating_matrix(zz, ["same", "a", "b"])
sim4 = compute_item_similarity(m4)
check("zero-variance item sim=0", sim4.loc["same", "a"] == 0.0 and sim4.loc["same", "b"] == 0.0,
      f"sim={sim4.loc['same', 'a']:.3f}")

# --- 6. 预测分数随机搜索: 是否可能越出 [1,5] ---
oob = []
for trial in range(300):
    rr = random.Random(trial)
    nr, nb = rr.randint(4, 8), rr.randint(3, 6)
    rrows = [
        {"user_id": f"u{k}", "book_id": f"k{j}", "value": rr.randint(1, 5)}
        for k in range(nr)
        for j in range(nb)
        if rr.random() < 0.6
    ]
    if not rrows:
        continue
    rr_df = pd.DataFrame(rrows)
    bb = [f"k{j}" for j in range(nb)]
    try:
        mm = build_rating_matrix(rr_df, bb)
        ss = compute_item_similarity(mm)
        bdf = pd.DataFrame({"id": bb, "title": bb, "author_id": ["a"] * nb})
        for u in list(mm.index):
            out = recommend(u, mm, ss, bdf, authors, top_n=5)
            for r in out.get("recommendations", []):
                if not (1 <= r["score"] <= 5):
                    oob.append((trial, u, r["book_id"], r["score"]))
    except Exception:  # noqa: BLE001
        continue
print(f"INFO | out-of-range scores found: {len(oob)}" + (f" e.g. {oob[:3]}" if oob else ""))

print()
print("FAILURES:", failures if failures else "none")

# --- 7. 跨进程确定性 (PYTHONHASHSEED 不同 => set 迭代序可能不同) ---
import subprocess

snippet = (
    "import sys; sys.path.insert(0,'recommendation'); "
    "import pandas as pd; from recommender import *; "
    "rows=[{'user_id':'u0','book_id':'b0','value':3}]; "
    "rows+=[{'user_id':f'u{i}','book_id':f'b{j}','value':((i*7+j)%5)+1} for i in range(1,5) for j in range(4)]; "
    "m=build_rating_matrix(pd.DataFrame(rows),[f'b{j}' for j in range(4)]); "
    "s=compute_item_similarity(m); "
    "b=pd.DataFrame({'id':[f'b{j}' for j in range(4)],'title':['T']*4,'author_id':['a']*4}); "
    "a=pd.DataFrame({'id':['a'],'name':['A']}); "
    "print([r['book_id'] for r in recommend('u0',m,s,b,a,top_n=3)['recommendations']], "
    "[r['score'] for r in recommend('u0',m,s,b,a,top_n=3)['recommendations']])"
)
orders = set()
import os

for seed in ("0", "1", "2"):
    out = subprocess.run(
        [sys.executable, "-c", snippet],
        capture_output=True,
        text=True,
        env={**os.environ, "PYTHONHASHSEED": seed},
        cwd=".",
    )
    orders.add(out.stdout.strip() or out.stderr.strip()[:80])
check("cross-process deterministic ordering (tie scenario)", len(orders) == 1 and "[]" not in orders, f"orders={orders}")

print("FINAL FAILURES:", failures if failures else "none")
