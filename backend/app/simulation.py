from __future__ import annotations

import argparse

from app.db import SessionLocal
from app.services.retail import reset_simulation, simulation_step


def main() -> None:
    parser = argparse.ArgumentParser(description="Run deterministic ShelfMind simulation steps.")
    parser.add_argument("--reset", action="store_true")
    parser.add_argument("--days", type=int, default=7)
    parser.add_argument("--algorithm", default="VALUE_ITERATION")
    args = parser.parse_args()
    with SessionLocal() as db:
        if args.reset:
            print(reset_simulation(db))
        print(simulation_step(db, days=args.days, algorithm=args.algorithm))


if __name__ == "__main__":
    main()

