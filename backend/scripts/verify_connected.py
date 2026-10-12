"""Explicit integration smoke: saves settings, analyzes an image and computes research results."""
from pathlib import Path
import httpx

ROOT = Path(__file__).resolve().parents[2]


def verify():
    with httpx.Client(base_url="http://127.0.0.1:8000", timeout=180) as client:
        health = client.get("/health")
        health.raise_for_status()
        assert health.json()["database"] == "connected"
        assert health.json()["productsCount"] == 4
        assert health.json()["salesRecordsCount"] == 1460
        dashboard = client.get("/api/dashboard").json()
        assert dashboard["store"]["managerName"] == "Zian"
        assert dashboard["dataSource"]["generated"] is True
        csv_path = ROOT / "shelfmind_retail_history.csv"
        imported = client.post("/api/history/import", files={"file": (csv_path.name, csv_path.read_bytes(), "text/csv")}, data={"provenance": "simulated"})
        imported.raise_for_status()
        assert imported.json()["inserted"] == 0
        assert imported.json()["skipped"] == 1460
        print("Supabase connected; CSV re-import skipped all 1,460 existing rows.", flush=True)
        saved = client.put("/api/settings", json=dashboard["settings"])
        saved.raise_for_status()
        assert saved.json()["managerName"] == "Zian"
        image_path = Path(r"C:\Users\zians\Downloads\ShelfWatch AI\images\1.png")
        analyzed = client.post("/api/shelfwatch/analyze", files={"file": (image_path.name, image_path.read_bytes(), "image/png")})
        analyzed.raise_for_status()
        assert analyzed.json()["product_count"] > 0
        assert analyzed.json()["original_image"]
        assert analyzed.json()["annotated_image"]
        assert client.post("/api/shelfwatch/analyze", files={"file": ("invalid.png", b"invalid", "image/png")}).status_code == 422
        print("Image inference passed:", analyzed.json()["product_count"], "facings; invalid image rejected.", flush=True)
        generated = client.post("/api/decisions/generate")
        generated.raise_for_status()
        assert len(generated.json()) >= 4
        print("Computed recommendations:", [(r["productName"], r["action"], r["status"]) for r in generated.json()], flush=True)
        trained = client.post("/api/rl/value-iteration/run", json={"iterations": 10, "seed": 42})
        trained.raise_for_status()
        assert trained.json()["metrics"]
        assert "evaluationSource" in trained.json()["environmentConfig"]
        assert client.post("/api/simulation/step", json={"days": 1}).status_code == 409
        latest = client.get("/api/dashboard").json()
        assert latest["shelfWatch"]["latestAnalysis"]["observed_at"] == analyzed.json()["observed_at"]
        assert latest["shelfWatch"]["shelfCompliance"] is None
        assert latest["metrics"]["unitsSold"] == 10814
        assert latest["metrics"]["lostSales"] == 965
        assert latest["metrics"]["wasteUnits"] == 14
        print("Settings, image and RL result persisted; imported history preserved.", flush=True)


if __name__ == "__main__":
    verify()
