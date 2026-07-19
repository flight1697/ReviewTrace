import os
import sys
from pathlib import Path


def load_local_environment() -> None:
    """加载本地 .env 文件，且不覆盖命令行里已经设置的环境变量。"""

    if "pytest" in sys.modules:
        return

    config_dirs = [
        Path.cwd(),
        Path(__file__).resolve().parents[4],
    ]
    env_paths: list[Path] = []
    for config_dir in config_dirs:
        for env_path in [config_dir / ".env.local", config_dir / ".env"]:
            if env_path not in env_paths:
                env_paths.append(env_path)

    for env_path in env_paths:
        if not env_path.exists():
            continue

        for line in env_path.read_text(encoding="utf-8").splitlines():
            stripped = line.strip()
            if not stripped or stripped.startswith("#") or "=" not in stripped:
                continue

            key, value = stripped.split("=", 1)
            key = key.strip()
            value = value.strip().strip('"').strip("'")
            if key and key not in os.environ:
                os.environ[key] = value
