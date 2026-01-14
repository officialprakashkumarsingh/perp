from playwright.sync_api import sync_playwright

def verify_mobile_settings(page):
    # Set Mobile Viewport
    page.set_viewport_size({"width": 375, "height": 812})
    page.goto("http://localhost:8080")

    # Open Settings
    page.click("#sidebar-toggle")
    page.wait_for_timeout(500)
    page.click("#settings-btn")
    page.wait_for_timeout(500)

    # Check if modal covers screen
    modal = page.locator(".modal-content")
    bbox = modal.bounding_box()
    print(f"Modal BBox: {bbox}")

    page.screenshot(path="verification_mobile_settings.png")

    # Check Logo Font
    font = page.locator(".logo").first.evaluate("el => getComputedStyle(el).fontFamily")
    print(f"Logo Font: {font}")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_mobile_settings(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
