import asyncio
from playwright.async_api import async_playwright
import http.server
import socketserver
import threading
import os
import json

PORT = 8092

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

            print("Verifying Logo...")
            logo_text = await page.inner_text('.logo')
            if "AhamAI" in logo_text and "अहम्" not in logo_text:
                print("✅ Logo updated.")
            else:
                print(f"❌ Logo text incorrect: {logo_text}")

            print("Verifying User Message Styling & Actions...")
            js_code = """
            (() => {
                uiHandler.appendUserMessage("Test User Message");
            })();
            """
            await page.evaluate(js_code)

            # Check font size of user-message
            font_size = await page.evaluate("getComputedStyle(document.querySelector('.user-message')).fontSize")
            if font_size == '16px' or font_size == '1rem':
                print(f"✅ User message font size: {font_size}")
            else:
                print(f"⚠️ User message font size: {font_size} (Expected ~16px)")

            # Check actions
            actions = await page.query_selector('.user-actions')
            if actions:
                print("✅ User message actions present.")
            else:
                print("❌ User message actions missing.")

            print("Verifying Incognito...")
            await page.click('#incognito-btn')
            has_class = await page.evaluate("document.body.classList.contains('incognito-mode')")
            if has_class:
                print("✅ Incognito mode active.")
            else:
                print("❌ Incognito mode failed.")

            print("Verifying Extension Dot...")
            await page.click('#extension-btn') # Open
            await page.click('#study-switch')  # Toggle Study

            has_dot = await page.evaluate("document.getElementById('extension-btn').classList.contains('active-dot')")
            if has_dot:
                print("✅ Extension dot active.")
            else:
                print("❌ Extension dot failed.")

            await page.screenshot(path='/home/jules/verification/verification_v7.png', full_page=True)
            print("Screenshot saved.")

        except Exception as e:
            print(f"Verification failed: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
