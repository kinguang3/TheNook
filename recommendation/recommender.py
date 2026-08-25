"""Item-Based Collaborative Filtering 推荐算法。

算法流程:
  1. 构建 User × Item 评分矩阵 (pivot_table)
  2. 计算 Item-Item Cosine Similarity
  3. 对于指定用户，用相似度加权预测未评分书籍
  4. 按预测分数降序返回 Top-N

NaN 处理说明:
  pivot_table 中未评分的值为 NaN。在计算余弦相似度时将 NaN 填充为 0，
  这意味着「未评分」等同于「评分为 0」。对于稀疏矩阵这是最简单直观的做法，
  后续可以考虑只在共同评分的维度上计算相似度来提高精度。
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
        for bid in all_book_ids:
            if bid not in matrix.columns:
                matrix[bid] = np.nan

    return matrix


def compute_item_similarity(matrix: pd.DataFrame) -> pd.DataFrame:
    """计算 Item-Item 余弦相似度。

    将 NaN 填充为 0 后计算。返回 DataFrame，行列都是 book_id。
    """
    # 填充 NaN 为 0：未评分视为「评分为 0」
    filled = matrix.fillna(0).values  # shape: (n_users, n_items)

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
    # 公式: pred(u, c) = Σ sim(c, i) * r(u, i) / Σ |sim(c, i)|
    # 其中 i 是用户已评过的书
    scores: dict[str, float] = {}
    rated_values = user_ratings[rated_mask]  # Series: book_id -> rating

    for candidate in candidate_items:
        # 取 candidate 与每本已评书的相似度
        sims = item_sim.loc[candidate, rated_values.index].values  # np.array
        ratings_arr = rated_values.values.astype(float)

        # 分母：相似度绝对值之和（避免负相似度互相抵消）
        denom = np.abs(sims).sum()
        if denom == 0:
            continue  # 与所有已评书无相似度，跳过

        numerator = (sims * ratings_arr).sum()
        scores[candidate] = numerator / denom

    if not scores:
        return {"status": "insufficient_data", "recommendations": []}

    # 按分数降序取 Top-N
    sorted_candidates = sorted(scores.items(), key=lambda x: x[1], reverse=True)[:top_n]

    # --- 组装结果：book_id -> title + author ---
    book_meta = books.set_index("id")[["title", "author_id"]].to_dict("index")
    author_map = authors.set_index("id")["name"].to_dict()

    results: list[RecResult] = []
    for book_id, score in sorted_candidates:
        meta = book_meta.get(book_id, {})
        author_name = author_map.get(meta.get("author_id", ""), "未知")
        results.append(
            RecResult(
                book_id=book_id,
                title=meta.get("title", book_id),
                author=author_name,
                score=round(score, 2),
            )
        )

    return {
        "status": "ok",
        "recommendations": [r.__dict__ for r in results],
    }
