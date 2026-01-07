from playwright.sync_api import sync_playwright

def run():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)

        # Mobile Context
        mobile_context = browser.new_context(
            viewport={'width': 375, 'height': 812},
            user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1'
        )
        page_mobile = mobile_context.new_page()
        page_mobile.goto("http://localhost:8080")

        # Inject a fake message with code block to test overflow
        page_mobile.evaluate("""
            const uiHandler = window.uiHandler;
            const { contentDiv } = uiHandler.createBotMessageContainer();
            uiHandler.updateBotMessage(contentDiv, 'Here is some code:\\n```html\\n<!DOCTYPE html>\\n<html>\\n<head>\\n<title>A Very Long Title That Might Cause Overflow If Not Handled Correctly</title>\\n</head>\\n<body>\\n  <div class="container">\\n    <h1>Hello World</h1>\\n  </div>\\n</body>\\n</html>\\n```');
        """)

        page_mobile.wait_for_timeout(1000)
        page_mobile.screenshot(path="verification_mobile.png", full_page=True)

        # Desktop Context
        page_desktop = browser.new_page()
        page_desktop.goto("http://localhost:8080")

        # Inject history items to see icons
        page_desktop.evaluate("""
            const chatManager = {
                chats: [
                    {id: '1', title: 'Test Chat 1', pinned: false, timestamp: new Date().toISOString()},
                    {id: '2', title: 'Test Chat 2', pinned: true, timestamp: new Date().toISOString()}
                ]
            };
            window.uiHandler.renderHistory(chatManager.chats, '1');
        """)
        # Force hover state via CSS or JS?
        # JS:
        page_desktop.evaluate("""
             const item = document.querySelector('.history-item');
             if(item) {
                 item.dispatchEvent(new MouseEvent('mouseover', {bubbles: true}));
                 // Or manually show actions since hover is hard in screenshots sometimes
                 const actions = item.querySelector('.history-actions');
                 if(actions) actions.style.display = 'flex';
             }
        """)

        page_desktop.wait_for_timeout(500)
        page_desktop.screenshot(path="verification_desktop.png")

        browser.close()

if __name__ == "__main__":
    run()
