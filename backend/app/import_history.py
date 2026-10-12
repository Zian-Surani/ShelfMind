"""Validated, transactional retail CSV import. Repeated imports do not duplicate rows."""
import argparse
import json
from pathlib import Path

from app.db import SessionLocal
from app.services.history_import import import_history


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    parser.add_argument("--provenance", choices=["simulated", "operational"], required=True)
    parser.add_argument("--replace-generated", action="store_true", help="Replace the untouched legacy generated scenario")
    args = parser.parse_args()
    with SessionLocal.begin() as db:
        result = import_history(db, args.path.read_bytes(), args.path.name,
                                generated=args.provenance == "simulated", replace_generated=args.replace_generated)
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    main()
