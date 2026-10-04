"""Item-Based Collaborative Filtering 推荐算法 (混合协同过滤 + 内容相似)。

算法流程:
  1. 构建 User × Item 评分矩阵 (pivot_table)
  2. 逐用户减去其评分均值 (mean-centering)，未评分维度残差记 0（中性）
  3. CF 相似度: 只在「共同评分者」维度上算余弦，并按共评人数做置信收缩:
       cf(i,j) = cos(i,j) * n / (n + beta)      n = 共同评分人数
  4. 内容相似度: 标签 Jaccard + 同作者 + 同系列
  5. 混合: sim = w * cf + (1 - w) * content,  其中 w = n / (n + beta)
     - 无共评者 (n=0) => 纯内容相似，小数据/新书不再零信号
     - 共评越多 => CF 越主导，避免内容相似度淹没真实口味信号
  6. 预测: pred(u, c) = mean(u) + Σ sim(c, i) * (r(u, i) - mean(u)) / Σ |sim(c, i)|
  7. 若用户残差全为 0（如只评过 1 本或全部同分），预测无法区分候选，
     改用「候选与已评书的内容相似度」排序（content rank 兜底）。

说明:
  - 分子可含负相似度（反相关残差以负权重计入），分母取 |sim| 之和避免抵消。
  - 展示分数钳制到 [1, 5]（加权残差公式理论可越界）。
"""

from dataclasses import dataclass

import numpy as np
import pandas as pd

# 置信收缩强度: beta=10 时共评 10 人 CF 才占 50% 权重
SHRINK_BETA = 10.0


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


def compute_content_similarity(books: pd.DataFrame) -> pd.DataFrame:
    """基于元数据的内容相似度: 标签 Jaccard + 同作者 + 同系列。

    Args:
        books: 至少含 id 列；可选 author_id, series_id, tags (list)。

    Returns:
        DataFrame，行列都是 book_id，值域 [0, 1]。
    """
    ids = list(books["id"]) if len(books) else []
    if not ids:
        return pd.DataFrame()

    has = lambda col: col in books.columns  # noqa: E731
    tags_col = (
        {r.id: set(r.tags) if isinstance(r.tags, list) else set() for r in books.itertuples()}
        if has("tags")
        else {i: set() for i in ids}
    )
    author_col = (
        {r.id: r.author_id for r in books.itertuples()} if has("author_id") else {}
    )
    series_col = (
        {r.id: getattr(r, "series_id", None) for r in books.itertuples()}
        if has("series_id")
        else {}
    )

    n = len(ids)
    sim = np.zeros((n, n), dtype=float)
    for a in range(n):
        sim[a, a] = 1.0
        for b in range(a + 1, n):
            ia, ib = ids[a], ids[b]
            ta, tb = tags_col.get(ia, set()), tags_col.get(ib, set())
            union = ta | tb
            jaccard = len(ta & tb) / len(union) if union else 0.0
            same_author = 1.0 if author_col.get(ia) and author_col.get(ia) == author_col.get(ib) else 0.0
            sa, sb = series_col.get(ia), series_col.get(ib)
            same_series = 1.0 if sa and sa == sb else 0.0
            s = 0.5 * jaccard + 0.3 * same_author + 0.2 * same_series
            sim[a, b] = sim[b, a] = s

    return pd.DataFrame(sim, index=ids, columns=ids)


def compute_item_similarity(
    matrix: pd.DataFrame,
    content_sim: pd.DataFrame | None = None,
    beta: float = SHRINK_BETA,
) -> pd.DataFrame:
    """计算混合 Item-Item 相似度矩阵。

    CF 部分: mean-centering 后只在共同评分者维度上算余弦，
    并做置信收缩 n/(n+beta)——共评人数越少，CF 信号越不可信。
    混合部分: sim = w*cf + (1-w)*content，w = n/(n+beta)；
    content_sim 为 None 时退化为收缩 CF。

    返回 DataFrame，行列都是 book_id，对角线为 1。
    """
    n_items = matrix.shape[1]
    if n_items == 0:
        return pd.DataFrame()

    # 逐用户减去均值（pandas mean 默认跳过 NaN），未评分残差为 0
    means = matrix.mean(axis=1)
    centered = matrix.sub(means, axis=0)
    values = centered.fillna(0).values  # (n_users, n_items)
    rated = matrix.notna().values  # (n_users, n_items)

    cf = np.zeros((n_items, n_items), dtype=float)
    w_mat = np.zeros((n_items, n_items), dtype=float)

    for a in range(n_items):
        for b in range(a + 1, n_items):
            common = rated[:, a] & rated[:, b]
            k = int(common.sum())
            if k == 0:
                continue
            xa, xb = values[common, a], values[common, b]
            na = float(np.sqrt((xa * xa).sum()))
            nb = float(np.sqrt((xb * xb).sum()))
            if na == 0 or nb == 0:
                continue  # 共评者中至少一方无残差变化 => CF 无信号
            cos = float((xa * xb).sum() / (na * nb))
            w = k / (k + beta)
            cf[a, b] = cf[b, a] = cos
            w_mat[a, b] = w_mat[b, a] = w

    # 混合: 共评多 => CF 主导; 无共评 => 纯内容
    combined = w_mat * cf
    if content_sim is not None and len(content_sim):
        c = content_sim.reindex(index=matrix.columns, columns=matrix.columns).fillna(0.0).values
        combined = combined + (1.0 - w_mat) * c
    np.fill_diagonal(combined, 1.0)

    return pd.DataFrame(combined, index=matrix.columns, columns=matrix.columns)


def _content_rank(
    content_sim: pd.DataFrame | None,
    candidates: list[str],
    rated_idx: pd.Index,
    top_n: int,
) -> list[tuple[str, float]] | None:
    """候选按「与已评书的平均内容相似度」降序返回 Top-N。

    无内容矩阵 / 无交集 / 全部亲和度为 0 时返回 None（不硬推无信号的书）。
    """
    if content_sim is None or not len(content_sim):
        return None
    cols = [i for i in rated_idx if i in content_sim.columns]
    if not cols:
        return None
    aff = [
        (c, float(content_sim.loc[c, cols].mean()))
        for c in candidates
        if c in content_sim.index
    ]
    if not aff or max(a for _, a in aff) <= 0:
        return None
    return sorted(aff, key=lambda x: (-x[1], x[0]))[:top_n]


def recommend(
    user_id: str,
    matrix: pd.DataFrame,
    item_sim: pd.DataFrame,
    books: pd.DataFrame,
    authors: pd.DataFrame,
    top_n: int = 5,
    content_sim: pd.DataFrame | None = None,
) -> dict:
    """为指定用户生成 Top-N 推荐。

    Args:
        user_id: 目标用户 UUID。
        matrix: User × Item 评分矩阵。
        item_sim: Item-Item 混合相似度矩阵。
        books: 书籍 DataFrame (id, title, author_id)。
        authors: 作者 DataFrame (id, name)。
        top_n: 返回数量。
        content_sim: 内容相似度矩阵；用于预测全并列/全空时的排序兜底。

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

    # --- 排序兜底: 预测全空或全并列（残差全 0，如只评过 1 本/全打同分）---
    # 此时加权残差无法区分候选，改按「与已评书的内容相似度」排序
    sorted_candidates: list[tuple[str, float]] = []
    if not scores or bool(np.allclose(residuals, 0)):
        ranked = _content_rank(content_sim, sorted(candidate_items), rated_values.index, top_n)
        if ranked:
            sorted_candidates = [(b, user_mean) for b, _ in ranked]
        elif not scores:
            return {"status": "insufficient_data", "recommendations": []}

    if not sorted_candidates:
        # 正常分支: 按分数降序取 Top-N；并列按 book_id，保证确定性
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
