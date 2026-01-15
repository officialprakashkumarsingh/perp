
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
        '.logo {', 'font-weight: 500;', # Logo less bold
        '.modify-popup {', # Modify popup class
        '@media (max-width: 600px)', # Mobile media query
        '.action-btn .btn-text {' # Hide text logic
    ]
    if not check_file_content('css/style.css', css_strings): all_passed = False

    # JS Checks
    js_strings = [
        'applyFontSize(size)', # New method
        'document.getElementById(\'font-size-select\')', # Listener
        '<span class="incognito-emoji">🤫</span>', # Emoji verified
        '<span class="btn-text">Copy</span>', # Wrapped text
        'popup.className = \'modify-popup\';', # New popup class
        '"Email Format"' # 25th item in modify list
    ]
    if not check_file_content('js/ui.js', js_strings): all_passed = False

    # HTML Checks
    html_strings = [
        '<select id="font-size-select">',
        '<option value="large">Large</option>'
    ]
    if not check_file_content('index.html', html_strings): all_passed = False

    if all_passed:
        print("\nAll verification checks passed!")
    else:
        print("\nSome verification checks failed.")

if __name__ == '__main__':
    verify()
