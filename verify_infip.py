
import os

def check_file_content(filepath, search_strings):
    with open(filepath, 'r') as f:
        content = f.read()

    missing = []
    for s in search_strings:
        if s not in content:
            missing.append(s)

    if missing:
        print(f"FAILED: {filepath} is missing: {missing}")
        return False
    else:
        print(f"PASSED: {filepath} contains all required strings.")
        return True

def verify():
    all_passed = True

    # Config Checks
    if not check_file_content('js/config.js', ['INFIP_API_KEY', 'api.infip.pro']): all_passed = False

    # API Checks
    if not check_file_content('js/api.js', ['generateImage(prompt, n', 'model: "img3"']): all_passed = False

    # App Logic Checks
    if not check_file_content('js/app.js', ['[IMAGE: {prompt} | n={number}]', 'finalAnswer.replace(imageRegex']): all_passed = False

    # UI Checks
    if not check_file_content('js/ui.js', ['.image-grid']): all_passed = False

    # HTML Removal Checks (Visuals should be gone)
    with open('index.html', 'r') as f:
        content = f.read()
    if 'sheet-visuals' in content or 'labs-stats' in content:
        print("FAILED: Visuals mode elements still present in index.html")
        all_passed = False
    else:
        print("PASSED: Visuals mode elements removed from index.html")

    if all_passed:
        print("\nAll verification checks passed!")
    else:
        print("\nSome verification checks failed.")

if __name__ == "__main__":
    verify()
