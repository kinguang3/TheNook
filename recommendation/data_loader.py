"""从 Supabase 读取 ratings / books / authors 数据。

所有读取使用 service_role_key 绕过 RLS，以获取全量评分数据。
"""

import time

import pandas as pd
from supabase import create_client

PAGE_SIZE = 1000
MAX_RETRIES = 3


def _fetch_all(client, table: str, columns: str) -> list[dict]:
    """分页拉取全量行，绕过 PostgREST 默认单页行数上限。

    按实际返回条数推进 offset，直到某页返回 0 行为止，
    避免服务端 max-rows 小于 PAGE_SIZE 时被静默截断。
    每页失败自动重试（网络瞬断常见）。
    """
    rows: list[dict] = []
    offset = 0
    while True:
        for attempt in range(MAX_RETRIES):
            try:
                page = (
                    client.table(table)
                    .select(columns)
                    .range(offset, offset + PAGE_SIZE - 1)
                    .execute()
                )
                break
            except Exception as e:  # noqa: BLE001
                if attempt == MAX_RETRIES - 1:
                    raise
                wait = 2**attempt
                print(f"  retry {attempt + 1}/{MAX_RETRIES} for {table}@{offset}: {e}")
                time.sleep(wait)
        data = page.data or []
        rows.extend(data)
        if not data:
            break
        offset += len(data)
    return rows


def load_ratings(supabase_url: str, service_key: str) -> pd.DataFrame:
    """读取全部评分行。

    Returns:
        DataFrame: user_id, book_id, value
    """
    client = create_client(supabase_url, service_key)
    # select 只取必要字段，减少传输量
    rows = _fetch_all(client, "ratings", "user_id, book_id, value")

    df = pd.DataFrame(rows)
    if df.empty:
        df = pd.DataFrame(columns=["user_id", "book_id", "value"])
    print(f"Loaded ratings: {len(df)}")
    return df


def load_books(supabase_url: str, service_key: str) -> pd.DataFrame:
    """读取全部书籍。

    Returns:
        DataFrame: id, title, author_id, series_id, tags
    """
    client = create_client(supabase_url, service_key)
    rows = _fetch_all(client, "books", "id, title, author_id, series_id, tags")
    df = pd.DataFrame(rows)
    if df.empty:
        df = pd.DataFrame(columns=["id", "title", "author_id", "series_id", "tags"])
    print(f"Loaded books: {len(df)}")
    return df


def load_authors(supabase_url: str, service_key: str) -> pd.DataFrame:
    """读取全部作者。

    Returns:
        DataFrame: id, name
    """
    client = create_client(supabase_url, service_key)
    rows = _fetch_all(client, "authors", "id, name")
    df = pd.DataFrame(rows)
    if df.empty:
        df = pd.DataFrame(columns=["id", "name"])
    print(f"Loaded authors: {len(df)}")
    return df
