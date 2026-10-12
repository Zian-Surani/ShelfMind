"""Check the persisted shelf image and honest, non-overlapping compliance states."""
import os
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

BASE_URL = os.environ.get("SHELFMIND_FRONTEND_URL", "http://127.0.0.1:5174")
API_URL = os.environ.get("SHELFMIND_API_URL", "http://127.0.0.1:8001")
ARTIFACTS = Path(__file__).resolve().parents[1] / "artifacts" / "browser"


def verify():
    ARTIFACTS.mkdir(parents=True, exist_ok=True)
    errors = []
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(channel="msedge", headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 1000})
        page.on("pageerror", lambda error: errors.append(str(error)))
        response = page.request.get(f"{API_URL}/api/shelfwatch")
        assert response.ok, response.status
        saved = response.json()
        analysis = saved["latestAnalysis"]
        assert analysis, "Upload a shelf image before running this read-only check."
        assert saved["shelfCompliance"] is None
        assert saved["itemsLowOnShelf"] is None
        page.goto(BASE_URL)
        page.get_by_role("button", name="Enter dashboard", exact=True).click()
        expect(page.get_by_text("Database connected", exact=False)).to_be_visible(timeout=60000)
        page.locator("aside").get_by_role("button", name="Shelf Watch", exact=True).click()
        panel = page.get_by_role("region", name="Planogram Compliance", exact=True)
        expect(panel).to_be_visible()
        expect(panel.get_by_text("Not evaluated", exact=True)).to_have_count(2)
        expect(panel.get_by_text("Reference layout and verified SKU mapping required.", exact=True)).to_be_visible()
        expect(page.get_by_text(
            f'{analysis["product_count"]} facings - {analysis["average_confidence"] * 100:.1f}% confidence',
            exact=False,
        )).to_be_visible()
        image = page.get_by_alt_text("ShelfWatch analyzed shelf")
        expect(image).to_have_js_property("complete", True)
        assert image.evaluate("image => image.naturalWidth > 0")
        annotated_src = image.get_attribute("src")
        assert annotated_src == f'data:image/jpeg;base64,{analysis["annotated_image"]}'
        page.get_by_role("checkbox", name="Bounding Boxes").uncheck()
        expect(image).to_have_attribute("src", f'data:image/jpeg;base64,{analysis["original_image"]}')
        page.get_by_role("checkbox", name="Bounding Boxes").check()
        expect(image).to_have_attribute("src", annotated_src)

        for width in [1440, 1280, 1024, 768, 390, 320]:
            page.set_viewport_size({"width": width, "height": 1000 if width >= 768 else 844})
            page.wait_for_timeout(200)
            if page.evaluate("document.documentElement.scrollWidth > innerWidth"):
                page.screenshot(path=str(ARTIFACTS / f"{width}-shelfwatch-overflow.png"), full_page=True)
                print(page.evaluate("""[...document.querySelectorAll('main *')]
                    .filter(element => element.getBoundingClientRect().right > innerWidth + 1)
                    .slice(0, 12).map(element => ({tag: element.tagName, classes: String(element.className),
                        text: element.textContent.slice(0, 80), right: element.getBoundingClientRect().right}))"""), flush=True)
            assert not page.evaluate("document.documentElement.scrollWidth > innerWidth"), width
            for row in panel.locator("dl > div").all():
                label = row.locator("dt").bounding_box()
                value = row.locator("dd").bounding_box()
                assert label["x"] + label["width"] < value["x"], (width, row.inner_text())
                for text in [row.locator("dt"), row.locator("dd")]:
                    assert text.evaluate("element => element.scrollWidth <= element.clientWidth"), width
            panel.screenshot(path=str(ARTIFACTS / f"{width}-planogram.png"))
            page.screenshot(path=str(ARTIFACTS / f"{width}-shelfwatch-status.png"), full_page=True)
        assert not errors, errors
        browser.close()
    print(f'Passed: {analysis["source_image_path"]}, {analysis["product_count"]} detections, persisted images, neutral compliance states, six responsive widths.', flush=True)


if __name__ == "__main__":
    verify()
