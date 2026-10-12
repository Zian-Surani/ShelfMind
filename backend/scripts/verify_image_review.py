"""Real browser/upload workflow against temporary SQLite; never mutates Supabase."""
import os
from pathlib import Path
import socket
import shutil
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen

from playwright.sync_api import expect, sync_playwright
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

BACKEND = Path(__file__).resolve().parents[1]
ROOT = BACKEND.parent
sys.path.insert(0, str(BACKEND))
from app.models import Base, Inventory, PurchaseOrder
from app.services.history_import import import_history

ARTIFACTS = BACKEND / "artifacts" / "browser"


def verify_browser(api, frontend):
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda error: errors.append(str(error)))

        page.goto(frontend)
        page.get_by_role("button", name="Enter dashboard", exact=True).click()
        expect(page.get_by_role("heading", name="Image review", exact=True)).to_be_visible()
        expect(page.get_by_text("Database connected", exact=False)).to_be_visible(timeout=60000)
        expect(page.get_by_text("Choose shelf photos", exact=True)).to_be_visible()
        page.get_by_label("Upload shelf images").set_input_files([str(ROOT / "images" / "1.png"), str(ROOT / "images" / "2.png")])
        expect(page.get_by_text("2 selected", exact=True)).to_be_visible(timeout=30000)
        expect(page.get_by_role("button", name="Upload images", exact=True)).to_be_enabled()
        evidence = page.request.get(f"{api}/api/shelfwatch/images").json()
        assert len(evidence) == 2
        assert next(row for row in evidence if row["filename"] == "1.png")["product_count"] == 24
        assert any(row["quality"]["status"] == "REVIEW_REQUIRED" for row in evidence)
        image = page.get_by_alt_text("ShelfMind analyzed shelf")
        expect(image).to_have_js_property("complete", True)
        assert image.evaluate("img => img.naturalWidth > 0")
        annotated = image.get_attribute("src")
        page.get_by_label("Detection boxes").uncheck()
        assert image.get_attribute("src") != annotated
        page.get_by_label("Detection boxes").check()

        def evaluate(item, quantity):
            page.get_by_label("Item ID", exact=True).select_option(item)
            expect(page.get_by_role("heading", name=f"{item} / Product evidence", exact=True)).to_be_visible()
            page.get_by_label("Verified total available units", exact=True).fill(str(quantity))
            page.get_by_role("checkbox", name="Item ID and total available stock verified", exact=False).check()
            with page.expect_response(lambda response: response.url.endswith("/api/shelfwatch/review")) as result:
                page.get_by_role("button", name="Evaluate item", exact=True).click()
            assert result.value.ok, result.value.text()
            expect(page.get_by_role("button", name="Evaluate item", exact=True)).to_be_enabled()
            return result.value.json()

        first = evaluate("SKU001", 3)
        assert first["quantity"] > 0 and first["status"] == "APPROVAL_REQUIRED"
        assert first["currentStock"] == 3 and len(first["imageReview"]["imageIds"]) == 2
        page.get_by_role("button", name="Approve", exact=True).click()
        expect(page.get_by_text("Approved", exact=True)).to_be_visible()
        high = evaluate("SKU001", 95)
        assert high["quantity"] == 0 and high["action"] == "REDUCE"
        page.get_by_role("button", name="Reject", exact=True).click()
        page.get_by_label("Reason", exact=True).fill("Test: recapture shelf before approving")
        page.get_by_role("button", name="Save decision", exact=True).click()
        expect(page.get_by_text("Rejected", exact=True)).to_be_visible()
        other = evaluate("SKU002", 10)
        assert other["productId"] == "SKU002"
        page.get_by_role("button", name="Adjust", exact=True).click()
        page.get_by_label("Order quantity", exact=True).fill(str(other["imageReview"]["assessment"]["minimumOrderQuantity"]))
        page.get_by_label("Reason", exact=True).fill("Test: smaller replenishment")
        page.get_by_role("button", name="Save decision", exact=True).click()
        expect(page.get_by_text("Adjusted & approved", exact=True)).to_be_visible()

        # Re-uploading identical bytes must not create a new observation.
        page.get_by_label("Upload shelf images").set_input_files(str(ROOT / "images" / "1.png"))
        expect(page.get_by_text("1 selected", exact=True)).to_be_visible()
        expect(page.get_by_role("button", name="Upload images", exact=True)).to_be_enabled()
        assert len(page.request.get(f"{api}/api/shelfwatch/images").json()) == 2

        # One corrupt image must not prevent a valid photo from completing.
        page.get_by_label("Upload shelf images").set_input_files([
            {"name": "corrupt.png", "mimeType": "image/png", "buffer": b"invalid image bytes"},
            {"name": "1.png", "mimeType": "image/png", "buffer": (ROOT / "images" / "1.png").read_bytes()},
        ])
        expect(page.get_by_role("alert")).to_contain_text("corrupt.png")
        expect(page.get_by_role("button", name="Upload images", exact=True)).to_be_enabled(timeout=30000)
        expect(page.get_by_text("1 selected", exact=True)).to_be_visible()

        page.reload()
        page.get_by_role("button", name="Enter dashboard", exact=True).click()
        page.get_by_label("Item ID", exact=True).select_option("SKU001")
        expect(page.get_by_text("Rejected", exact=True)).to_be_visible(timeout=30000)
        expect(page.get_by_alt_text("ShelfMind analyzed shelf")).to_be_visible()
        reviews = page.request.get(f"{api}/api/products/SKU001/review-history").json()
        assert len(reviews["reviews"]) == 2
        assert all(row["productId"] == "SKU001" for row in reviews["reviews"])

        for width in [1440, 1280, 1024, 768, 390, 320]:
            page.set_viewport_size({"width": width, "height": 1000 if width >= 768 else 844})
            page.wait_for_timeout(150)
            assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), width
            page.screenshot(path=str(ARTIFACTS / f"{width}-image-review.png"), full_page=True)
            for chart in page.get_by_role("img", name="Demand & sales").all():
                assert chart.locator("polyline").count() > 0
        assert not errors, errors
        browser.close()
    print("Passed: multi-image inference, quality, count-sensitive MDP, per-ID graphs, approve/adjust/reject, deduplication, partial failures, reload persistence, six viewport widths.", flush=True)


def verify():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="shelfmind-browser-", ignore_cleanup_errors=True) as temporary:
        database = Path(temporary) / "review.db"
        database_url = f"sqlite:///{database.as_posix()}"
        engine = create_engine(database_url)
        Base.metadata.create_all(engine)
        with Session(engine) as db:
            import_history(db, (ROOT / "shelfmind_retail_history.csv").read_bytes(), "test-history.csv", generated=True)
            db.commit()
            before = [(row.id, row.shelf_quantity, row.backroom_quantity, row.incoming_quantity) for row in db.scalars(select(Inventory))]
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            port = sock.getsockname()[1]
        api = f"http://127.0.0.1:{port}"
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            frontend_port = sock.getsockname()[1]
        frontend = f"http://127.0.0.1:{frontend_port}"
        environment = {**os.environ, "SHELFMIND_DATABASE_URL": database_url, "SHELFMIND_CORS_ORIGINS": frontend, "VITE_API_BASE_URL": api}
        with (ARTIFACTS / "isolated-api.log").open("w") as log:
            process = subprocess.Popen([str(BACKEND / ".venv" / "Scripts" / "python.exe"), "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", str(port)],
                cwd=BACKEND, env=environment, stdout=log, stderr=log, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            vite = subprocess.Popen([shutil.which("node"), str(ROOT / "frontend" / "node_modules" / "vite" / "bin" / "vite.js"), "--host", "127.0.0.1", "--port", str(frontend_port), "--strictPort"],
                cwd=ROOT / "frontend", env=environment, stdout=log, stderr=log, creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0))
            try:
                for _ in range(100):
                    try:
                        with urlopen(f"{api}/health", timeout=1) as response:
                            assert response.status == 200
                            break
                    except OSError:
                        time.sleep(0.1)
                else:
                    raise RuntimeError("Isolated test API did not start; see artifacts/browser/isolated-api.log")
                verify_browser(api, frontend)
                with Session(engine) as db:
                    assert db.query(PurchaseOrder).count() == 0
                    assert before == [(row.id, row.shelf_quantity, row.backroom_quantity, row.incoming_quantity) for row in db.scalars(select(Inventory))]
            finally:
                for child in (process, vite):
                    if os.name == "nt":
                        subprocess.run(["taskkill", "/PID", str(child.pid), "/T", "/F"], capture_output=True)
                    else:
                        child.terminate()
                    child.wait(timeout=15)
                engine.dispose()


if __name__ == "__main__":
    verify()
