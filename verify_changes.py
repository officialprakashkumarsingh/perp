from playwright.sync_api import sync_playwright, expect
import re

def run(playwright):
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://localhost:8000")

    # 1. Verify Amoled Theme
    print("Opening Settings...")
    # Use force=True because sometimes settings button might be obstructed or sidebar logic
    page.locator("#settings-btn").click()
    expect(page.locator("#settings-modal")).to_be_visible()

    print("Selecting Amoled Theme...")
    page.select_option("#theme-select", "amoled")

    # Check body class and background color
    expect(page.locator("body")).to_have_class(re.compile(r"amoled-theme"))

    # Wait for transition if any
    page.wait_for_timeout(500)

    bg_color = page.evaluate("getComputedStyle(document.body).backgroundColor")
    print(f"Body Background Color: {bg_color}")

    if "rgb(0, 0, 0)" in bg_color or "rgba(0, 0, 0" in bg_color:
        print("SUCCESS: Background is black.")
    else:
        print(f"FAILURE: Background is {bg_color}")

    page.screenshot(path="verification_amoled.png")

    # Close settings
    page.locator(".close-modal").click()

    # 2. Verify Browser History Toggle
    print("Opening Extension Sheet...")
    # The button is dynamically added with class 'attach-btn' and id 'extension-btn'
    # Wait for it to exist
    page.wait_for_selector("#extension-btn")
    page.click("#extension-btn")

    expect(page.locator("#extension-sheet")).to_be_visible()
    expect(page.locator("#sheet-history")).to_be_visible()

    print("Extension sheet visible. Taking screenshot...")
    page.screenshot(path="verification_extensions.png")

    browser.close()

if __name__ == "__main__":
    with sync_playwright() as playwright:
        run(playwright)
