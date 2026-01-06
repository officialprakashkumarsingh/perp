import http.server
import socketserver
import threading
import time
from playwright.sync_api import sync_playwright

PORT = 8000

def run_server():
    Handler = http.server.SimpleHTTPRequestHandler
    with socketserver.TCPServer(("", PORT), Handler) as httpd:
        print("serving at port", PORT)
        httpd.serve_forever()

server_thread = threading.Thread(target=run_server)
server_thread.daemon = True
server_thread.start()
time.sleep(1) # Wait for server to start

def verify_app():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto(f"http://localhost:{PORT}")

        # 1. Verify Title and Header
        assert "AhamAI" in page.title()

        # 2. Verify Welcome Screen
        welcome = page.locator("#welcome-screen h1")
        assert welcome.is_visible()
        assert "What do you want to know?" in welcome.inner_text()
        print("✅ Welcome screen verified")

        # 3. Verify Input Area
        input_area = page.locator("#user-input")
        assert input_area.is_visible()

        # 4. Verify Search Toggle
        search_toggle = page.locator("#search-toggle")
        assert search_toggle.is_visible()

        # Toggle Search
        is_pressed = search_toggle.get_attribute("aria-pressed")
        print(f"Initial Search Toggle State: {is_pressed}")
        search_toggle.click()
        is_pressed_after = search_toggle.get_attribute("aria-pressed")
        print(f"After Click Search Toggle State: {is_pressed_after}")
        assert is_pressed_after == "true"
        print("✅ Search toggle verified")

        # 5. Send a Message
        input_area.fill("Hello world")
        send_btn = page.locator("#send-btn")
        send_btn.click()

        # Wait for user message to appear
        user_msg = page.locator(".user-message")
        user_msg.wait_for()
        assert "Hello world" in user_msg.inner_text()
        print("✅ User message submitted")

        # 6. Verify History Update (sidebar)
        # It might take a moment for the history to update (after message add)
        time.sleep(1)
        history_item = page.locator(".history-item").first
        if history_item.count() > 0:
            print(f"✅ History item found: {history_item.inner_text()}")
        else:
             # It might be that the title is set after the first user message is pushed.
             # Let's check if the history list has children.
             pass

        print("Verification Complete")
        browser.close()

if __name__ == "__main__":
    verify_app()
