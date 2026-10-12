"""Read-only browser checks for the welcome flow and saved-history analytics."""
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE_URL = os.environ.get("SHELFMIND_FRONTEND_URL", "http://127.0.0.1:5174")
ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts" / "browser"


def check_width(page):
    assert not page.evaluate("document.documentElement.scrollWidth > innerWidth")


def verify():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    errors = []
    failed_api_responses = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page()
        page.on("pageerror", lambda error: errors.append(str(error)))
        page.on("response", lambda response: failed_api_responses.append(
            (response.url, response.status)
        ) if "/api/" in response.url and response.status >= 400 else None)

        for width, height in [(1440, 1000), (1920, 1080), (768, 1024), (390, 844), (320, 568)]:
            page.set_viewport_size({"width": width, "height": height})
            page.goto(BASE_URL)
            expect(page.get_by_role("heading", name="ShelfMind", exact=True)).to_be_visible()
            for image in [page.get_by_alt_text("ShelfMind logo"), page.locator("main img")]:
                expect(image).to_be_visible()
                expect(image).to_have_js_property("complete", True)
                assert image.evaluate("img => img.naturalWidth > 0")
            assert page.locator("footer").bounding_box()["y"] < height
            check_width(page)
            page.screenshot(path=str(ARTIFACTS / f"{width}-welcome.png"), full_page=True)

            enter = page.get_by_role("button", name="Enter dashboard", exact=True)
            enter.focus()
            page.keyboard.press("Enter")
            expect(page.get_by_text("Database connected", exact=False)).to_be_visible(timeout=60000)
            exit_button = page.get_by_role("button", name="Exit to landing page", exact=True)
            expect(exit_button).to_be_visible()
            search = page.get_by_placeholder("Search products, decisions, or orders...")
            search.fill("shelf")
            check_width(page)
            page.screenshot(path=str(ARTIFACTS / f"{width}-welcome-dashboard.png"), full_page=True)
            exit_button.click()
            expect(enter).to_be_visible()
            enter.click()
            expect(search).to_have_value("")

            if width == 1440:
                page.locator("aside").get_by_role("button", name="Analytics", exact=True).click()
                expect(page.get_by_role("heading", name="Retail History & Analytics")).to_be_visible()
                with page.expect_response(lambda response: "/api/analytics?days=365" in response.url) as result:
                    page.get_by_role("button", name="365 days", exact=True).click()
                response = result.value
                assert response.ok, response.status
                payload = response.json()
                assert payload["dataSource"]["rows"] > 0
                expect(page.get_by_text(f'{payload["totals"]["unitsSold"]:,}', exact=True)).to_be_visible()
                expect(page.get_by_role("alert")).to_have_count(0)
                page.screenshot(path=str(ARTIFACTS / "connected-analytics.png"), full_page=True)
                print(f'Analytics loaded {payload["dataSource"]["rows"]} saved rows from {response.url}', flush=True)
                exit_button.click()
                expect(enter).to_be_visible()
                enter.click()

            if width == 320:
                page.get_by_role("button", name="Notifications", exact=True).click()
                popover = page.get_by_text("Store Alerts", exact=True).locator("../..")
                bounds = popover.bounding_box()
                assert bounds["x"] >= 0 and bounds["x"] + bounds["width"] <= width
                page.keyboard.press("Escape")

        offline = browser.new_page(viewport={"width": 390, "height": 844}, reduced_motion="reduce")
        offline.on("pageerror", lambda error: errors.append(str(error)))
        offline.route("**/api/**", lambda route: route.abort())
        offline.goto(BASE_URL)
        expect(offline.get_by_role("heading", name="ShelfMind", exact=True)).to_be_visible()
        offline.get_by_role("button", name="Enter dashboard", exact=True).click()
        expect(offline.get_by_text("Connection unavailable", exact=False)).to_be_visible(timeout=10000)
        offline.get_by_role("button", name="Exit to landing page", exact=True).click()
        expect(offline.get_by_role("heading", name="ShelfMind", exact=True)).to_be_visible()
        check_width(offline)
        assert not errors, errors
        assert not failed_api_responses, failed_api_responses
        browser.close()
    print("Passed: logo, landing, keyboard entry, Exit, responsive layouts, saved DB analytics, offline navigation.", flush=True)


if __name__ == "__main__":
    verify()
