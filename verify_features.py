from playwright.sync_api import sync_playwright

def verify_quiz_flashcards(page):
    page.goto("http://localhost:8080")

    # Simulate Quiz generation response
    quiz_json = """[QUIZ_JSON]
    {
      "questions": [
        { "question": "What is 2+2?", "options": ["3", "4", "5", "6"], "answerIndex": 1 }
      ]
    }
    [/QUIZ_JSON]"""

    page.evaluate(f"""(json) => {{
        const uiHandler = window.uiHandler;
        const {{ contentDiv }} = uiHandler.createBotMessageContainer();
        uiHandler.updateBotMessage(contentDiv, json);
    }}""", quiz_json)

    # Wait for quiz container
    page.wait_for_selector(".quiz-container")
    print("Quiz rendered.")
    page.screenshot(path="verification_quiz.png")

    # Simulate Flashcard generation response
    flashcard_json = """[FLASHCARDS_JSON]
    {
      "cards": [
        { "front": "Front 1", "back": "Back 1" },
        { "front": "Front 2", "back": "Back 2" }
      ]
    }
    [/FLASHCARDS_JSON]"""

    page.evaluate(f"""(json) => {{
        const uiHandler = window.uiHandler;
        const {{ contentDiv }} = uiHandler.createBotMessageContainer();
        uiHandler.updateBotMessage(contentDiv, json);
    }}""", flashcard_json)

    # Wait for flashcards container
    page.wait_for_selector(".flashcards-container")
    print("Flashcards rendered.")
    page.screenshot(path="verification_flashcards.png")

if __name__ == "__main__":
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        try:
            verify_quiz_flashcards(page)
        except Exception as e:
            print(f"Error: {e}")
        finally:
            browser.close()
