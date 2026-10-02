"""验证问题 5/6/7 是否属实。用法: python _verify_algo.py [--after]"""

import sys

import pandas as pd

sys.path.insert(0, "recommendation")
from recommender import build_rating_matrix, compute_item_similarity, recommend

after = "--after" in sys.argv

# --- 论断7: 评分>=1 且 NaN->0, 向量恒非负 => cosine 永远 >= 0 ---
multi = pd.DataFrame(
    [
        {"user_id": "u1", "book_id": "A", "value": 5},
        {"user_id": "u1", "book_id": "B", "value": 1},
        {"user_id": "u2", "book_id": "A", "value": 1},
        {"user_id": "u2", "book_id": "B", "value": 5},
        {"user_id": "u3", "book_id": "A", "value": 4},
        {"user_id": "u4", "book_id": "B", "value": 2},
    ]
)
m = build_rating_matrix(multi, ["A", "B"])
sim = compute_item_similarity(m)
print(f"[7] sim range: [{sim.values.min():.3f}, {sim.values.max():.3f}] | negative exists: {bool((sim.values < 0).any())}")

# 口味冲突: u1爱A恨B, u2恨A爱B => A与B应是反相关
print(f"[5/6] taste-conflict sim(A,B): {sim.loc['A','B']:.3f} (期望为负值反相关, 原始cosine=+0.385)")

# --- 论断6: 预测=该用户已评分的加权平均, 苛刻用户被压在自己区间 ---
trend = pd.DataFrame(
    [
        {"user_id": "uL", "book_id": "rated", "value": 1},
        {"user_id": "uG1", "book_id": "rated", "value": 5},
        {"user_id": "uG1", "book_id": "cand", "value": 5},
        {"user_id": "uG2", "book_id": "rated", "value": 5},
        {"user_id": "uG2", "book_id": "cand", "value": 5},
    ]
)
m2 = build_rating_matrix(trend, ["rated", "cand"])
sim2 = compute_item_similarity(m2)
books = pd.DataFrame({"id": ["rated", "cand"], "title": ["R", "C"], "author_id": ["x", "x"]})
authors = pd.DataFrame({"id": ["x"], "name": ["X"]})
res = recommend("uL", m2, sim2, books, authors, top_n=1)
pred = res["recommendations"][0]["score"] if res["status"] == "ok" else res["status"]
print(f"[6] harsh-user pred(cand): {pred} (uL只评过1分; 原公式必被压在其自身评分区间)")

# --- 论断5: 未评分的向量维度按什么计入 ---
print(f"[5] uL row in centered matrix: {m2.loc['uL'].round(2).to_dict()} (NaN处处理体现5的修复)")

# --- 回归: 8用户场景推荐仍然合理 ---
B = ["byh", "xyx", "ey", "zx", "dyx", "dfk", "wrs", "xl"]
R = {
    "u01": {"byh": 5, "xyx": 5, "ey": 4, "dyx": 4, "wrs": 2},
    "u02": {"byh": 5, "xyx": 4, "ey": 5, "dyx": 3, "xl": 1},
    "u03": {"byh": 4, "xyx": 5, "ey": 5, "dfk": 3, "xl": 2},
    "u04": {"byh": 1, "xyx": 2, "ey": 1, "zx": 5, "dfk": 5, "wrs": 4, "xl": 4},
    "u05": {"byh": 5, "xyx": 4},
    "u06": {"byh": 3, "xyx": 3, "ey": 4, "zx": 4, "dyx": 3, "dfk": 4, "wrs": 5},
    "u07": {"byh": 4, "ey": 5, "dyx": 4, "zx": 2, "dfk": 3},
    "u08": {"zx": 4, "dfk": 5, "wrs": 5, "xl": 4},
}
rows = [{"user_id": u, "book_id": b, "value": v} for u, d in R.items() for b, v in d.items()]
ratings = pd.DataFrame(rows)
books8 = pd.DataFrame({"id": B, "title": ["T_" + b for b in B], "author_id": ["x"] * 8})
m3 = build_rating_matrix(ratings, B)
sim3 = compute_item_similarity(m3)
for u in ["u01", "u05"]:
    r3 = recommend(u, m3, sim3, books8, authors, top_n=3)
    print(f"regression {u}: {r3['status']} -> {[(x['book_id'], x['score']) for x in r3['recommendations']]}")
