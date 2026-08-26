"""清理测试数据：删除测试用户的 ratings → profiles → auth.users。

删除顺序：ratings 先（FK 依赖），再 auth.users（profiles 由 cascade 自动删除）。
只清理邮箱后缀为 @test.example 的用户，不动真实数据。
"""

from config import load_config
from supabase import create_client

TEST_DOMAIN = "test.example"


def main() -> None:
    cfg = load_config()
    client = create_client(cfg["SUPABASE_URL"], cfg["SUPABASE_SERVICE_ROLE_KEY"])

    # 找到所有测试用户
    users = client.auth.admin.list_users()
    test_users = [u for u in users if u.email and u.email.endswith(f"@{TEST_DOMAIN}")]

    if not test_users:
        print("No test users found. Nothing to clean.")
        return

    print(f"Found {len(test_users)} test users:")
    test_ids = []
    for u in test_users:
        print(f"  {u.email} ({u.id[:8]}...)")
        test_ids.append(u.id)

    # 1) 删除 ratings（测试用户的评分行）
    deleted_ratings = 0
    for uid in test_ids:
        resp = client.table("ratings").delete().eq("user_id", uid).execute()
        deleted_ratings += len(resp.data) if resp.data else 0
    print(f"\nDeleted ratings: {deleted_ratings}")

    # 2) 删除 auth.users（profiles 由 FK on delete cascade 自动删除）
    deleted_users = 0
    for uid in test_ids:
        try:
            client.auth.admin.delete_user(uid)
            deleted_users += 1
        except Exception as e:
            print(f"  Warning: could not delete user {uid[:8]}...: {e}")
    print(f"Deleted auth users: {deleted_users}")
    print("\nDone.")


if __name__ == "__main__":
    main()
