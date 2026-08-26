"""创建测试数据：8 个测试用户 + 设计评分数据。

幂等设计：已存在的测试用户复用已有 ID，评分 upsert 防重复。
测试用户邮箱统一后缀 @test.example，便于清理时识别。
"""

from config import load_config
from supabase import create_client

TEST_DOMAIN = "test.example"
PASSWORD = "TestOnly-2026-nook"

# 8 本书的真实 ID（直接用 schema.sql 种子数据中的 ID）
BOOKS = {
    "byh": "journey-under-the-midnight-sun",   # 白夜行
    "xyx": "the-devotion-of-suspect-x",        # 嫌疑人X的献身
    "ey":  "malice",                            # 恶意
    "zx":  "tokyo-zodiac-murders",             # 占星术杀人魔法
    "dyx": "points-and-lines",                 # 点与线
    "dfk": "murder-on-the-orient-express",     # 东方快车谋杀案
    "wrs": "and-then-there-were-none",         # 无人生还
    "xl":  "the-greek-coffin-mystery",          # 希腊棺材之谜
}

# 评分数据设计
# key = 测试用户编号, value = dict[book_id -> rating]
# 只列出有评分的书，未列出的视为未评分（推荐算法候选）
TEST_USERS_RATINGS: dict[str, dict[str, int]] = {
    # 社会派/心理组：喜欢日系社会派，不喜欢硬核推理流
    "01": {
        BOOKS["byh"]: 5,
        BOOKS["xyx"]: 5,
        BOOKS["ey"]:  4,
        BOOKS["dyx"]: 4,
        BOOKS["wrs"]: 2,
        # 未评: 占星/东快/希腊棺材
    },
    "02": {
        BOOKS["byh"]: 5,
        BOOKS["xyx"]: 4,
        BOOKS["ey"]:  5,
        BOOKS["dyx"]: 3,
        BOOKS["xl"]:  1,
        # 未评: 占星/东快/无人生还
    },
    "03": {
        BOOKS["byh"]: 4,
        BOOKS["xyx"]: 5,
        BOOKS["ey"]:  5,
        BOOKS["dfk"]: 3,
        BOOKS["xl"]:  2,
        # 未评: 占星/点与线/无人生还
    },
    # 本格诡计组：与 A/B/C 兴趣相反
    "04": {
        BOOKS["byh"]: 1,
        BOOKS["xyx"]: 2,
        BOOKS["ey"]:  1,
        BOOKS["zx"]:  5,
        BOOKS["dfk"]: 5,
        BOOKS["wrs"]: 4,
        BOOKS["xl"]:  4,
        # 未评: 点与线（仅剩1本候选）
    },
    # 稀疏用户：只评 2 本
    "05": {
        BOOKS["byh"]: 5,
        BOOKS["xyx"]: 4,
        # 未评: 其余 6 本
    },
    # 广泛用户：评 7 本，仅剩 1 本候选
    "06": {
        BOOKS["byh"]: 3,
        BOOKS["xyx"]: 3,
        BOOKS["ey"]:  4,
        BOOKS["zx"]:  4,
        BOOKS["dyx"]: 3,
        BOOKS["dfk"]: 4,
        BOOKS["wrs"]: 5,
        # 未评: 希腊棺材（仅剩1本候选）
    },
    # 社会派变体（含占星术低分，增强两组书区分度）
    "07": {
        BOOKS["byh"]: 4,
        BOOKS["ey"]:  5,
        BOOKS["dyx"]: 4,
        BOOKS["zx"]:  2,
        BOOKS["dfk"]: 3,
        # 未评: 嫌疑人X/无人生还/希腊棺材
    },
    # 欧美本格补充
    "08": {
        BOOKS["zx"]:  4,
        BOOKS["dfk"]: 5,
        BOOKS["wrs"]: 5,
        BOOKS["xl"]:  4,
        # 未评: 白夜行/嫌疑人X/恶意/点与线
    },
}


def get_existing_test_users(client) -> dict[str, str]:
    """获取已存在的测试用户，返回 {email: user_id}。"""
    users = client.auth.admin.list_users()
    return {
        u.email: u.id
        for u in users
        if u.email and u.email.endswith(f"@{TEST_DOMAIN}")
    }


def create_test_users(client, existing: dict[str, str]) -> dict[str, str]:
    """创建测试用户，已存在的复用 ID。返回 {user_num: user_id}。"""
    result: dict[str, str] = {}
    for num in TEST_USERS_RATINGS:
        email = f"test_user_{num}@{TEST_DOMAIN}"
        if email in existing:
            result[num] = existing[email]
            print(f"  User test_user_{num}: exists (reusing {existing[email][:8]}...)")
            continue
        resp = client.auth.admin.create_user({
            "email": email,
            "password": PASSWORD,
            "email_confirm": True,  # 跳过邮箱验证
        })
        uid = resp.user.id
        result[num] = uid
        print(f"  User test_user_{num}: created ({uid[:8]}...)")
    return result


def insert_ratings(client, user_map: dict[str, str]) -> int:
    """批量 upsert 测试评分，返回插入/更新条数。"""
    count = 0
    for num, ratings in TEST_USERS_RATINGS.items():
        uid = user_map[num]
        for book_id, value in ratings.items():
            client.table("ratings").upsert(
                {"user_id": uid, "book_id": book_id, "value": value},
                on_conflict="user_id,book_id",
            ).execute()
            count += 1
    return count


def main() -> None:
    cfg = load_config()
    client = create_client(cfg["SUPABASE_URL"], cfg["SUPABASE_SERVICE_ROLE_KEY"])

    print("Checking existing test users...")
    existing = get_existing_test_users(client)

    print("Creating test users...")
    user_map = create_test_users(client, existing)

    print("Inserting ratings...")
    total = insert_ratings(client, user_map)

    print(f"\nDone: {len(user_map)} users, {total} ratings")
    print("User IDs:")
    for num in sorted(user_map):
        print(f"  test_user_{num}: {user_map[num]}")


if __name__ == "__main__":
    main()
