from playwright.sync_api import sync_playwright
import time

def verify_fixes(page):
    page.goto("http://localhost:8000")
    page.wait_for_load_state("networkidle")

    # 1. Verify Logo Font
    print("Verifying Logo...")
    # Target the desktop sidebar logo
    logo = page.locator(".sidebar .logo")
    logo.wait_for()
    page.screenshot(path="verification_logo.png")

    # 2. Verify Mobile Settings Visibility
    print("Verifying Mobile Settings...")
    page.set_viewport_size({"width": 375, "height": 667})
    # Open sidebar
    page.click("#sidebar-toggle")
    page.wait_for_selector(".sidebar.open")
    time.sleep(0.5) # Wait for transition

    # Click Settings
    page.click("#settings-btn")

    # Check if modal is visible
    modal = page.locator("#settings-modal")
    modal.wait_for(state="visible")
    time.sleep(0.5) # Wait for fade in

    # Take screenshot of mobile settings
    page.screenshot(path="verification_mobile_settings.png")

    # 3. Verify JSON Widget Rendering
    print("Verifying JSON Widget...")
    # Reset Viewport
    page.set_viewport_size({"width": 1280, "height": 720})
    page.reload()
    page.wait_for_load_state("networkidle")

    # Inject message with Quiz JSON
    # Escape newlines for JS string
    quiz_json = r'[QUIZ_JSON] { "questions": [ { "question": "Test Question?", "options": ["A", "B"], "answerIndex": 0 } ] } [/QUIZ_JSON]'

    # Use evaluate to call uiHandler directly
    page.evaluate(f"""
        const container = document.querySelector('.messages-list');
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        const contentDiv = document.createElement('div');
        contentDiv.className = 'bot-message-content';
        msgDiv.appendChild(contentDiv);
        container.appendChild(msgDiv);

        // Simulate text update
        window.uiHandler.updateBotMessage(contentDiv, 'Here is a quiz: ' + '{quiz_json}');
    """)

    # Check if widget is rendered
    page.wait_for_selector(".quiz-container")

    # Check if text "QUIZ_JSON" is present (should NOT be)
    content = page.locator(".bot-message-content").text_content()
    if "[QUIZ_JSON]" in content:
        print("FAIL: JSON tag still visible")
    else:
        print("PASS: JSON tag hidden")

    page.screenshot(path="verification_quiz_render.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page()
        try:
            verify_fixes(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
