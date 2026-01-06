import asyncio
from playwright.async_api import async_playwright
import http.server
import socketserver
import threading
import os
import json

PORT = 8090

def run_server():
    try:
        handler = http.server.SimpleHTTPRequestHandler
        with socketserver.TCPServer(("", PORT), handler) as httpd:
            print(f"Serving at port {PORT}")
            httpd.serve_forever()
    except Exception as e:
        print(f"Server error: {e}")

async def verify():
    # Start server
    server_thread = threading.Thread(target=run_server)
    server_thread.daemon = True
    server_thread.start()
    await asyncio.sleep(2)

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto(f'http://localhost:{PORT}')
            await page.wait_for_timeout(2000)

            print("Verifying Extensions Sheet...")

            # 1. Click Extension Button
            await page.click('#extension-btn')
            await page.wait_for_selector('#extension-sheet.open')
            print("✅ Extension sheet opened.")

            # 2. Check Items
            items = await page.query_selector_all('.extension-item')
            if len(items) == 3:
                print("✅ Found Attach, Search, and Study items.")
            else:
                print(f"❌ Incorrect item count: {len(items)}")

            # 3. Toggle Study Mode
            await page.click('#study-switch')
            is_study = await page.is_checked('#study-switch')
            if is_study:
                print("✅ Study toggle works.")
            else:
                print("❌ Study toggle failed.")

            print("Verifying Integrations Removal...")
            await page.click('#settings-btn')
            await page.wait_for_selector('#settings-modal.open')

            integrations = await page.query_selector('.integrations-grid')
            if not integrations:
                print("✅ Integrations section removed from Settings.")
            else:
                # Double check content
                count = await page.evaluate("document.querySelectorAll('.integration-card').length")
                if count == 0:
                    print("✅ Integrations grid is empty.")
                else:
                    print(f"❌ Integrations still present ({count}).")

            await page.screenshot(path='verification_v6.png', full_page=True)
            print("Screenshot saved.")

        except Exception as e:
            print(f"Verification failed: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
