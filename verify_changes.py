from playwright.sync_api import sync_playwright

def verify_queue_and_font(page):
    page.goto("http://localhost:8080")

    # 1. Verify Font
    font_family = page.locator(".sidebar .logo").evaluate("el => getComputedStyle(el).fontFamily")
    print(f"Logo Font: {font_family}")

    # 2. Verify Incognito Icon
    page.set_viewport_size({"width": 375, "height": 812})
    icon_width = page.locator("#incognito-btn").evaluate("el => getComputedStyle(el).width")
    print(f"Incognito Btn Width: {icon_width}")
    page.screenshot(path="verification_mobile_header.png")

    # 3. Verify Queue Logic
    page.set_viewport_size({"width": 1280, "height": 720})

    # Just check if element exists, don't wait for visibility if it's hidden
    if page.locator("#queue-panel").count() > 0:
        print("Queue panel exists.")

    # Manually invoke JS to simulate queue
    page.evaluate("window.uiHandler.updateQueuePanel([{query: 'Queued Message 1'}, {query: 'Queued Message 2'}])")

    # Now it should be visible
    page.wait_for_selector("#queue-panel", state="visible")

    # Click toggle to expand list if needed (default might be block/none check logic)
    # The toggle logic toggles the list display
    page.click("#queue-toggle")

    page.screenshot(path="verification_queue_panel.png")
    print("Queue panel visible and toggled.")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_queue_and_font(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
