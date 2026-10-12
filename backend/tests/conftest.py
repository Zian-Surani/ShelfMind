from __future__ import annotations

import os
import sys
from pathlib import Path

os.environ.setdefault("SHELFMIND_DATABASE_URL", "sqlite:///./test_shelfmind.db")

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))
