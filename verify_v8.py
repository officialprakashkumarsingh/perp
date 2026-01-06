import asyncio
from playwright.async_api import async_playwright
import http.server
import socketserver
import threading
import os
import json

PORT = 8094

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

            print("Verifying Font...")
            # Check font-family of .logo-text
            font = await page.evaluate("getComputedStyle(document.querySelector('.logo-text')).fontFamily")
            print(f"Logo Font: {font}")
            if "Poppins" in font:
                print("✅ Logo uses Poppins.")
            else:
                print("❌ Logo font check failed.")

            print("Verifying Suggestions...")
            suggestions = await page.query_selector_all('.suggestion-card')
            if len(suggestions) >= 4:
                print("✅ Suggestions displayed.")
                # Test click
                await suggestions[0].click()
                val = await page.input_value('#user-input')
                if len(val) > 0:
                    print("✅ Suggestion click populated input.")
                else:
                    print("❌ Suggestion click failed.")
            else:
                print("❌ Suggestions missing.")

            print("Verifying Incognito UI...")
            # Reload to reset state if needed
            await page.reload()
            await page.wait_for_selector('#incognito-btn')

            # Click incognito
            await page.evaluate("document.getElementById('incognito-btn').click()")

            # Check Title
            title = await page.inner_text('#welcome-title')
            if "Incognito Mode" in title:
                print("✅ Welcome title changed for Incognito.")
            else:
                print(f"❌ Welcome title mismatch: {title}")

            # Check Theme (should NOT have amoled/dark class on body for this specific incognito request, user said 'keep theme light')
            # But earlier code added .incognito-mode class which had dark styles.
            # I removed the class definition in CSS, but the JS adds it.
            # Let's check if background is still light (approx).
            bg_color = await page.evaluate("getComputedStyle(document.body).backgroundColor")
            print(f"Background Color: {bg_color}")
            if "rgb(253, 253, 252)" in bg_color or "255" in bg_color: # #fdfdfc
                print("✅ Theme remained light.")
            else:
                print("⚠️ Theme might have changed (Dark?).")

            print("Verifying Sidebar Icons (SVG)...")
            # We need history. Mock it.
            await page.evaluate("""
                uiHandler.renderHistory([{id: '1', title: 'Test Chat', pinned: false, timestamp: new Date().toISOString()}], null);
            """)
            await page.wait_for_selector('.history-action-btn svg')
            print("✅ Sidebar icons are SVGs.")

            await page.screenshot(path='/home/jules/verification/verification_v8.png', full_page=True)
            print("Screenshot saved.")

        except Exception as e:
            print(f"Verification failed: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
