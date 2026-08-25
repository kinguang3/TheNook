"""Supabase 配置读取"""

import sys
from os import environ
from pathlib import Path

from dotenv import load_dotenv


def load_config() -> dict[str, str]:
    """从 .env 加载环境变量并校验必填项。

    Returns:
        包含 SUPABASE_URL 和 SUPABASE_SERVICE_ROLE_KEY 的字典。

    Raises:
        SystemExit: 缺少必填环境变量时直接退出。
    """
    # 加载 recommendation/.env
    env_path = Path(__file__).parent / ".env"
    load_dotenv(env_path)

    supabase_url = environ.get("SUPABASE_URL", "")
    service_key = environ.get("SUPABASE_SERVICE_ROLE_KEY", "")

    missing: list[str] = []
    if not supabase_url:
        missing.append("SUPABASE_URL")
    if not service_key:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")

    if missing:
        for name in missing:
            print(f"Missing {name}")
        sys.exit(1)

    return {
        "SUPABASE_URL": supabase_url,
        "SUPABASE_SERVICE_ROLE_KEY": service_key,
    }
