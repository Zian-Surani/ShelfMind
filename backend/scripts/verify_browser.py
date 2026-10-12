"""Local browser smoke test. Requires playwright and Microsoft Edge."""
import os
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
ARTIFACTS = ROOT / "backend" / "artifacts" / "browser"
ARTIFACTS.mkdir(parents=True, exist_ok=True)
BASE_URL = os.environ.get("SHELFMIND_FRONTEND_URL", "http://127.0.0.1:5174")


def verify():
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.goto(BASE_URL)
        page.get_by_role("heading", name="ShelfMind", exact=True).wait_for()
        page.get_by_role("button", name="Enter dashboard", exact=True).click()
        page.get_by_text("Database connected", exact=False).wait_for(timeout=60000)
        assert "Zian" in page.locator("h1").inner_text()
        assert "Simulated history" in page.locator("main").inner_text()
        page.screenshot(path=str(ARTIFACTS / "desktop-home.png"), full_page=True)
        for tab in ["Inventory", "Decisions", "Analytics", "Shelf Watch", "RL Research", "Settings"]:
            page.locator("aside").get_by_role("button", name=tab, exact=True).click()
            page.wait_for_timeout(500)
            if tab == "Analytics":
                page.get_by_role("button", name="365 days", exact=True).click()
                page.get_by_text("10,814", exact=True).wait_for(timeout=60000)
                page.get_by_role("button", name="7 days", exact=True).click()
                page.get_by_text("2026-09-08 to 2026-09-14", exact=False).wait_for(timeout=60000)
            if tab == "Shelf Watch":
                image = page.get_by_alt_text("ShelfWatch analyzed shelf")
                image.wait_for(timeout=10000)
                assert image.evaluate("image => image.naturalWidth > 0")
            page.screenshot(path=str(ARTIFACTS / f"desktop-{tab.replace(' ', '-').lower()}.png"), full_page=True)
        for width in [390, 768]:
            page.set_viewport_size({"width": width, "height": 844})
            page.reload()
            page.get_by_role("button", name="Enter dashboard", exact=True).click()
            page.get_by_text("Database connected", exact=False).wait_for(timeout=60000)
            if width < 768:
                for tab in ["Command Center", "Inventory", "Decisions", "Analytics", "Shelf Watch", "RL Research", "Settings"]:
                    page.get_by_role("navigation", name="Main navigation").get_by_role("button", name=tab, exact=True).click()
                    page.wait_for_timeout(500)
                    overflow = page.evaluate("document.documentElement.scrollWidth > innerWidth")
                    if overflow:
                        offenders = page.evaluate("""[...document.querySelectorAll('body *')].filter(e =>
                          e.getBoundingClientRect().right > innerWidth + 2 && getComputedStyle(e).position !== 'fixed')
                          .slice(0, 8).map(e => ({tag: e.tagName, className: String(e.className), right: e.getBoundingClientRect().right}))""")
                        print("OVERFLOW", width, tab, offenders, flush=True)
                    page.screenshot(path=str(ARTIFACTS / f"{width}-{tab.replace(' ', '-').lower()}.png"), full_page=True)
                    assert not overflow, (width, tab)
            else:
                assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), width
        assert not errors, errors
        print("Browser checks passed: desktop/mobile navigation, CSV analytics periods, persisted image, no JS errors.", flush=True)
        browser.close()


if __name__ == "__main__":
    verify()
