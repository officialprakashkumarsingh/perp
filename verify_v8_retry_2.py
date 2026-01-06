import asyncio
from playwright.async_api import async_playwright
import http.server
import socketserver
import threading
import os
import json

PORT = 8096

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
                # Test click (via evaluate to ensure JS execution)
                await page.evaluate("document.querySelector('.suggestion-card').click()")
                await page.wait_for_timeout(500)
                # Since click calls submitForm, input might be cleared.
                # We should check if message list has the item.
                msgs = await page.query_selector_all('.user-message')
                if len(msgs) > 0:
                    print("✅ Suggestion click triggered submission.")
                else:
                    print("❌ Suggestion click failed to submit.")
            else:
                print("❌ Suggestions missing.")

            print("Verifying Incognito UI (Desktop Force)...")
            # Force show mobile header for test
            await page.add_style_tag(content=".mobile-header { display: flex !important; }")
            await page.wait_for_selector('#incognito-btn')

            # Click incognito
            await page.click('#incognito-btn')

            # Check Title
            title = await page.inner_text('#welcome-title')
            if "Incognito Mode" in title:
                print("✅ Welcome title changed for Incognito.")
            else:
                print(f"❌ Welcome title mismatch: {title}")

            # Check SVG icon usage in button
            icon_html = await page.inner_html('#incognito-btn')
            if '<svg' in icon_html:
                print("✅ Incognito button uses SVG.")
            else:
                print("❌ Incognito button missing SVG.")

            print("Verifying Sidebar Icons (SVG)...")
            # We need history. Mock it.
            await page.evaluate("""
                uiHandler.renderHistory([{id: '1', title: 'Test Chat', pinned: false, timestamp: new Date().toISOString()}], null);
            """)

            # Check if SVG exists in action buttons
            # We need to hover or force visibility logic is handled by CSS, but DOM should contain it.
            # Actually history-actions display none unless hover.
            # We can force display
            await page.add_style_tag(content=".history-actions { display: flex !important; opacity: 1 !important; }")

            # Check for SVG inside button
            svg_count = await page.evaluate("document.querySelectorAll('.history-action-btn svg').length")
            if svg_count > 0:
                print(f"✅ Sidebar icons are SVGs (Count: {svg_count}).")
            else:
                print("❌ Sidebar icons missing SVGs.")

            await page.screenshot(path='/home/jules/verification/verification_v8.png', full_page=True)
            print("Screenshot saved.")

        except Exception as e:
            print(f"Verification failed: {e}")
        finally:
            await browser.close()

if __name__ == "__main__":
    asyncio.run(verify())
