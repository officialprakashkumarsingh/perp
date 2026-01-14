from playwright.sync_api import sync_playwright

def verify_theme(page):
    page.goto("http://localhost:8080")

    # Open settings
    page.click("#settings-btn")
    page.wait_for_timeout(500)

    # Select Cream & Orange theme
    page.select_option("#theme-select", "cream-orange")
    page.wait_for_timeout(500)

    # Close settings
    page.click(".close-modal")
    page.wait_for_timeout(500)

    # Take screenshot of main UI
    page.set_viewport_size({"width": 1280, "height": 720})
    page.screenshot(path="verification_theme_cream_orange.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_theme(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
