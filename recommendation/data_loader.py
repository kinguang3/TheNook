"""从 Supabase 读取 ratings / books / authors 数据。

所有读取使用 service_role_key 绕过 RLS，以获取全量评分数据。
"""

import pandas as pd
from supabase import create_client


def load_ratings(supabase_url: str, service_key: str) -> pd.DataFrame:
    """读取全部评分行。

    Returns:
        DataFrame: user_id, book_id, value
    """
    client = create_client(supabase_url, service_key)
    rows: list[dict] = []
    # select 只取必要字段，减少传输量
    page = client.table("ratings").select("user_id, book_id, value").execute()
    rows.extend(page.data)

    df = pd.DataFrame(rows)
    if df.empty:
        df = pd.DataFrame(columns=["user_id", "book_id", "value"])
    print(f"Loaded ratings: {len(df)}")
    return df


def load_books(supabase_url: str, service_key: str) -> pd.DataFrame:
    """读取全部书籍。

    Returns:
        DataFrame: id, title, author_id
    """
    client = create_client(supabase_url, service_key)
    page = client.table("books").select("id, title, author_id").execute()
    df = pd.DataFrame(page.data)
    if df.empty:
        df = pd.DataFrame(columns=["id", "title", "author_id"])
    print(f"Loaded books: {len(df)}")
    return df


def load_authors(supabase_url: str, service_key: str) -> pd.DataFrame:
    """读取全部作者。

    Returns:
        DataFrame: id, name
    """
    client = create_client(supabase_url, service_key)
    page = client.table("authors").select("id, name").execute()
    df = pd.DataFrame(page.data)
    if df.empty:
        df = pd.DataFrame(columns=["id", "name"])
    print(f"Loaded authors: {len(df)}")
    return df
