from playwright.sync_api import sync_playwright

def verify_sidebar(page):
    page.goto("http://localhost:8080")
    page.set_viewport_size({"width": 375, "height": 812})
    page.click("#sidebar-toggle")
    page.wait_for_timeout(500)
    page.screenshot(path="verification_mobile.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_sidebar(page)
        except:
            pass
        finally:
            browser.close()
