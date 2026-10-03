"""Item-Based Collaborative Filtering 推荐算法 (Adjusted Cosine)。

算法流程:
  1. 构建 User × Item 评分矩阵 (pivot_table)
  2. 逐用户减去其评分均值 (mean-centering)，未评分维度记 0（= 用户平均水平，中性）
  3. 计算 Item-Item 余弦相似度 (此时向量可含负值，相似度可为负)
  4. 对于指定用户，用相似度加权预测未评分书籍:
       pred(u, c) = mean(u) + Σ sim(c, i) * (r(u, i) - mean(u)) / Σ |sim(c, i)|
  5. 按预测分数降序返回 Top-N

说明:
  - mean-centering 消除用户评分尺度差异（苛刻/宽松用户），使相似度反映
    「口味方向」而非「打分水平」；口味冲突的书会得到负相似度。
  - 未评分不等同于 0 分：centering 后按用户均值代入，残差为 0（中性）。
  - 分母取 |sim| 之和：负相似度（反相关）的残差会以负权重计入分子，
    避免正负相似度在分母互相抵消。
"""

from dataclasses import dataclass

import numpy as np
import pandas as pd
from sklearn.metrics.pairwise import cosine_similarity


@dataclass
class RecResult:
    """单条推荐结果。"""
    book_id: str
    title: str
    author: str
    score: float


def build_rating_matrix(
    ratings: pd.DataFrame,
    all_book_ids: list[str] | None = None,
) -> pd.DataFrame:
    """将评分行列表转换为 User × Item 矩阵。

    Args:
        ratings: 必须包含 user_id, book_id, value 三列。
        all_book_ids: 全量书籍 ID 列表，确保无人评分的书也出现在矩阵列中。

    Returns:
        DataFrame，index=user_id, columns=book_id, values=评分(int)。
        未评分为 NaN。
    """
    matrix = ratings.pivot_table(
        index="user_id",
        columns="book_id",
        values="value",
        aggfunc="first",  # 同一 user+book 只有一行，防重
    )

    # 补全无人评分的书（pivot_table 会丢弃全空列）
    if all_book_ids is not None:
        valid = set(all_book_ids)
        # 剔除孤儿评分：评分引用了已从 books 表删除的书
        orphans = [c for c in matrix.columns if c not in valid]
        if orphans:
            print(f"Dropped {len(orphans)} orphan rating columns (book deleted): {orphans}")
            matrix = matrix.drop(columns=orphans)
        for bid in all_book_ids:
            if bid not in matrix.columns:
                matrix[bid] = np.nan

    return matrix


def compute_item_similarity(matrix: pd.DataFrame) -> pd.DataFrame:
    """计算 Item-Item Adjusted Cosine 相似度。

    逐用户减去其评分均值 (mean-centering) 后再计算余弦相似度：
    - 未评分 (NaN) 在减均值后填 0，即残差为 0 = 用户平均水平（中性）。
    - 向量因此可含负值，相似度范围 [-1, 1]，口味冲突的书为负相似度。
    返回 DataFrame，行列都是 book_id。
    """
    # 逐用户减去均值（pandas mean 默认跳过 NaN）
    means = matrix.mean(axis=1)
    centered = matrix.sub(means, axis=0)
    # NaN 残差填 0：未评分 = 用户平均水平，不携带口味信号
    filled = centered.fillna(0).values  # shape: (n_users, n_items)

    # cosine_similarity 计算 item 之间的相似度，输入 shape (n_samples, n_features)
    # 这里每个 item 是一个 n_users 维的向量，所以转置后输入
    sim = cosine_similarity(filled.T)  # shape: (n_items, n_items)

    return pd.DataFrame(sim, index=matrix.columns, columns=matrix.columns)


def recommend(
    user_id: str,
    matrix: pd.DataFrame,
    item_sim: pd.DataFrame,
    books: pd.DataFrame,
    authors: pd.DataFrame,
    top_n: int = 5,
) -> dict:
    """为指定用户生成 Top-N 推荐。

    Args:
        user_id: 目标用户 UUID。
        matrix: User × Item 评分矩阵。
        item_sim: Item-Item 相似度矩阵。
        books: 书籍 DataFrame (id, title, author_id)。
        authors: 作者 DataFrame (id, name)。
        top_n: 返回数量。

    Returns:
        {"status": "...", "recommendations": [...]}
    """
    # --- 冷启动检查 ---
    all_users = set(matrix.index)
    if user_id not in all_users:
        return {"status": "user_not_found", "recommendations": []}

    all_items = set(matrix.columns)
    if len(all_items) == 0:
        return {"status": "insufficient_data", "recommendations": []}

    # 该用户已评分的书籍
    user_ratings = matrix.loc[user_id]
    rated_mask = user_ratings.notna()
    rated_items = set(user_ratings[rated_mask].index)
    candidate_items = all_items - rated_items

    if len(rated_items) == 0:
        return {"status": "insufficient_data", "recommendations": []}

    if len(candidate_items) == 0:
        return {"status": "no_candidates", "recommendations": []}

    # --- 预测每本候选书的评分 ---
    # 公式: pred(u, c) = mean(u) + Σ sim(c, i) * (r(u, i) - mean(u)) / Σ |sim(c, i)|
    # 其中 i 是用户已评过的书；相似度可为负（反相关残差以负权重计入）
    scores: dict[str, float] = {}
    rated_values = user_ratings[rated_mask]  # Series: book_id -> rating
    user_mean = rated_values.mean()
    residuals = rated_values.values.astype(float) - user_mean

    # sorted 迭代候选：候选来自 set，固定顺序保证跨进程结果一致
    for candidate in sorted(candidate_items):
        # 取 candidate 与每本已评书的相似度
        sims = item_sim.loc[candidate, rated_values.index].values  # np.array

        # 分母：相似度绝对值之和（正负相似度不互相抵消）
        denom = np.abs(sims).sum()
        if denom == 0:
            continue  # 与所有已评书无相似度，跳过

        numerator = (sims * residuals).sum()
        scores[candidate] = user_mean + numerator / denom

    if not scores:
        return {"status": "insufficient_data", "recommendations": []}

    # 按分数降序取 Top-N；并列时按 book_id 排序，保证确定性
    sorted_candidates = sorted(scores.items(), key=lambda x: (-x[1], x[0]))[:top_n]

    # --- 组装结果：book_id -> title + author ---
    book_meta = books.set_index("id")[["title", "author_id"]].to_dict("index")
    author_map = authors.set_index("id")["name"].to_dict()

    results: list[RecResult] = []
    for book_id, score in sorted_candidates:
        meta = book_meta.get(book_id, {})
        author_name = author_map.get(meta.get("author_id", ""), "未知")
        # 预测值理论可越出评分值域 (加权残差公式)，展示时钳制到 [1, 5]
        clamped = float(np.clip(score, 1.0, 5.0))
        results.append(
            RecResult(
                book_id=book_id,
                title=meta.get("title", book_id),
                author=author_name,
                score=round(clamped, 2),
            )
        )

    return {
        "status": "ok",
        "recommendations": [r.__dict__ for r in results],
    }
