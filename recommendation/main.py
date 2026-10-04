"""命令行入口: python main.py --user-id USER_ID [--top-n 5]"""

import argparse
import sys

from config import load_config
from data_loader import load_authors, load_books, load_ratings
from recommender import (
    build_rating_matrix,
    compute_content_similarity,
    compute_item_similarity,
    recommend,
)


def main() -> None:
    # Windows 控制台默认 GBK，书名为 UTF-8 时输出乱码
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    parser = argparse.ArgumentParser(description="The Nook 推荐算法")
    parser.add_argument("--user-id", required=True, help="用户 UUID")
    parser.add_argument("--top-n", type=int, default=5, help="推荐数量 (默认 5)")
    args = parser.parse_args()

    # 1. 加载配置
    config = load_config()
    url = config["SUPABASE_URL"]
    key = config["SUPABASE_SERVICE_ROLE_KEY"]

    # 2. 从 Supabase 读取数据
    ratings = load_ratings(url, key)
    books = load_books(url, key)
    authors = load_authors(url, key)

    if ratings.empty:
        print("\nNo ratings in database. Insufficient data for recommendations.")
        return

    # 3. 构建评分矩阵 + 混合相似度（CF 收缩 + 内容相似）
    all_book_ids = books["id"].tolist()
    matrix = build_rating_matrix(ratings, all_book_ids)
    content_sim = compute_content_similarity(books)
    item_sim = compute_item_similarity(matrix, content_sim=content_sim)

    # 4. 生成推荐
    result = recommend(
        user_id=args.user_id,
        matrix=matrix,
        item_sim=item_sim,
        books=books,
        authors=authors,
        top_n=args.top_n,
        content_sim=content_sim,
    )

    # 5. 输出结果
    status = result["status"]
    recs = result["recommendations"]

    display_id = args.user_id[:8] + "..." if len(args.user_id) > 8 else args.user_id

    print("\n" + "=" * 40)
    print("The Nook Recommendation")
    print("=" * 40)
    print(f"User: {display_id}")
    print(f"Status: {status}")

    if not recs:
        print("\nNo recommendations available.")
        print("(Possible reasons: user not found, insufficient data, or no candidates)")
    else:
        for i, rec in enumerate(recs, 1):
            print(f"\n{i}. {rec['title']}")
            print(f"   Author: {rec['author']}")
            print(f"   Score: {rec['score']}")

    print("\n" + "=" * 40)


if __name__ == "__main__":
    main()
