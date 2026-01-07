from playwright.sync_api import sync_playwright

def verify_ui():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        # Mobile view verification
        context = browser.new_context(
            viewport={'width': 375, 'height': 667},
            device_scale_factor=2,
            is_mobile=True,
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 11_0 like Mac OS X) AppleWebKit/604.1.38 (KHTML, like Gecko) Version/11.0 Mobile/15A372 Safari/604.1'
        )
        page = context.new_page()

        # Load local page
        page.goto('http://localhost:8000')
        page.wait_for_load_state('networkidle')

        # 1. Verify Mobile Input Area
        # It should be visible at the bottom
        page.screenshot(path='verification/mobile_home.png')

        # 2. Open Settings
        # In mobile, settings is in sidebar. Open sidebar first.
        page.click('#sidebar-toggle')
        page.wait_for_timeout(500) # Wait for animation
        page.click('#settings-btn')
        page.wait_for_timeout(500) # Wait for modal

        # 3. Verify Settings Modal Tabs
        page.screenshot(path='verification/mobile_settings.png')

        # Click Personalization Tab
        page.click('.settings-nav-item[data-tab="personalization"]')
        page.wait_for_timeout(300)
        page.screenshot(path='verification/mobile_settings_personalization.png')

        browser.close()

if __name__ == "__main__":
    verify_ui()
