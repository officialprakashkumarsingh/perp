
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

    # CSS Checks
    css_strings = [
        '.labs-stats {',
        'body.visuals-mode .bot-message-content img'
    ]
    if not check_file_content('css/style.css', css_strings): all_passed = False

    # JS Checks
    js_strings = [
        'isVisualsMode',
        'toggleVisualsMode(active)',
        'startLabsTimer()',
        'GOAL: Your PRIMARY objective is to answer the user\'s request using VISUAL content'
    ]
    # Check both JS files
    if not check_file_content('js/ui.js', ['toggleVisualsMode', 'startLabsTimer']): all_passed = False
    if not check_file_content('js/app.js', ['isVisualsMode', 'GOAL: Your PRIMARY objective']): all_passed = False

    # HTML Checks
    html_strings = [
        'id="visuals-switch"',
        'id="labs-stats"'
    ]
    if not check_file_content('index.html', html_strings): all_passed = False

    if all_passed:
        print("\nAll verification checks passed!")
    else:
        print("\nSome verification checks failed.")

if __name__ == '__main__':
    verify()
