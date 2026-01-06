class UIHandler {
    constructor() {
        this.messagesList = document.getElementById('messages-list');
        this.userInput = document.getElementById('user-input');
        this.modelSelect = document.getElementById('model-select');
        this.searchToggle = document.getElementById('search-toggle');
        this.sendBtn = document.getElementById('send-btn');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.historyList = document.getElementById('history-list');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.fileInput = null;
        this.currentAttachment = null;
        this.onDeleteChat = null;
        this.onLoadChat = null;

        // Initialize Mermaid
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({ startOnLoad: false, theme: 'default' });
        }
    }

    init(onSubmit, onHistoryAction) {
        // Create file input hidden
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.pdf';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);

        // Attach Button Logic
        const leftControls = document.querySelector('.left-controls');
        const attachBtn = document.createElement('button');
        attachBtn.type = 'button';
        attachBtn.className = 'attach-btn';
        attachBtn.innerHTML = '+'; // Or a clip icon SVG
        attachBtn.title = 'Attach PDF';
        attachBtn.addEventListener('click', () => this.fileInput.click());
        leftControls.insertBefore(attachBtn, leftControls.firstChild);

        // File selection
        this.fileInput.addEventListener('change', (e) => {
            if (this.fileInput.files.length > 0) {
                this.handleFileSelect(this.fileInput.files[0]);
            }
        });
        // Auto-resize textarea
        this.userInput.addEventListener('input', () => {
            this.userInput.style.height = 'auto';
            this.userInput.style.height = (this.userInput.scrollHeight) + 'px';
            this.sendBtn.disabled = this.userInput.value.trim().length === 0;
        });

        // Submit on Enter (without Shift)
        this.userInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (!this.sendBtn.disabled) {
                    this.submitForm(onSubmit);
                }
            }
        });

        // Form Submit
        document.getElementById('input-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitForm(onSubmit);
        });

        // Model Select
        CONFIG.MODELS.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            this.modelSelect.appendChild(option);
        });

        // Search Toggle
        this.searchToggle.addEventListener('click', () => {
            const isPressed = this.searchToggle.getAttribute('aria-pressed') === 'true';
            this.searchToggle.setAttribute('aria-pressed', !isPressed);
        });

        // Sidebar Toggle (Mobile)
        if (this.sidebarToggle) {
            this.sidebarToggle.addEventListener('click', () => {
                this.sidebar.classList.toggle('open');
            });
        }

        // New Chat Button
        this.newChatBtn.addEventListener('click', () => {
            if (onHistoryAction) onHistoryAction('new');
            // Close mobile sidebar
            this.sidebar.classList.remove('open');
        });

        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth <= 768) {
                if (!this.sidebar.contains(e.target) && !this.sidebarToggle.contains(e.target) && this.sidebar.classList.contains('open')) {
                    this.sidebar.classList.remove('open');
                }
            }
        });

        // Setup History Actions callbacks
        this.onHistoryAction = onHistoryAction;
    }

    submitForm(onSubmit) {
        const text = this.userInput.value.trim();
        if (!text && !this.currentAttachment) return;

        const model = this.modelSelect.value;
        const isSearchEnabled = this.searchToggle.getAttribute('aria-pressed') === 'true';
        const attachment = this.currentAttachment;

        this.userInput.value = '';
        this.userInput.style.height = 'auto';
        this.sendBtn.disabled = true;
        this.clearAttachment();

        // Hide welcome screen
        this.welcomeScreen.style.display = 'none';

        onSubmit(text, model, isSearchEnabled, attachment);
    }

    handleFileSelect(file) {
        this.currentAttachment = file;

        // Render Attachment Chip
        const inputTopRow = document.querySelector('.input-top-row');
        let chip = document.getElementById('attachment-chip');
        if (!chip) {
            chip = document.createElement('div');
            chip.id = 'attachment-chip';
            chip.className = 'attachment-chip';
            inputTopRow.insertBefore(chip, this.userInput);
        }

        chip.innerHTML = `
            <span>📄 ${file.name}</span>
            <button type="button" class="attachment-remove">×</button>
        `;

        chip.querySelector('.attachment-remove').addEventListener('click', () => {
            this.clearAttachment();
        });
    }

    clearAttachment() {
        this.currentAttachment = null;
        this.fileInput.value = '';
        const chip = document.getElementById('attachment-chip');
        if (chip) chip.remove();
    }

    appendUserMessage(text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';
        msgDiv.innerHTML = `
            <div class="user-message-container">
                <div class="user-message">${this.escapeHtml(text)}</div>
            </div>
        `;
        this.messagesList.appendChild(msgDiv);
        this.scrollToBottom();
    }

    createBotMessageContainer() {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';

        // Structure: Sources (optional) + Content
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'sources-section';
        sourcesDiv.style.display = 'none'; // Hidden initially

        const contentDiv = document.createElement('div');
        contentDiv.className = 'bot-message-container';

        const textDiv = document.createElement('div');
        textDiv.className = 'bot-message-content';

        contentDiv.appendChild(textDiv);
        msgDiv.appendChild(sourcesDiv);
        msgDiv.appendChild(contentDiv);

        this.messagesList.appendChild(msgDiv);
        this.scrollToBottom();

        return { messageDiv: msgDiv, sourcesDiv, contentDiv: textDiv };
    }

    renderSources(container, sources) {
        if (!sources || sources.length === 0) return;

        container.style.display = 'block';
        container.innerHTML = `
            <div class="sources-header">
                <span class="sources-icon">≡</span> Sources
            </div>
            <div class="sources-grid">
                ${sources.map((source, index) => `
                    <a href="${source.url}" target="_blank" class="source-card" title="${this.escapeHtml(source.title)}">
                        <div class="source-title">${this.escapeHtml(source.title)}</div>
                        <div class="source-index">${index + 1}</div>
                        <div class="source-url">${new URL(source.url).hostname}</div>
                    </a>
                `).join('')}
            </div>
        `;
    }

    showLoading(container) {
        container.innerHTML = '<div class="loading-indicator">Thinking...</div>';
        return container.querySelector('.loading-indicator');
    }

    removeLoading(loadingElement) {
        if (loadingElement) loadingElement.remove();
    }

    updateBotMessage(container, text) {
        // Pre-process Latex (simple block detection to avoid markdown messing it up?)
        // Actually, let's just use marked.js and then render KaTeX on the result.
        // Marked might escape some characters used in LaTeX.
        // Ideally we use a marked extension, but here we can try a multi-pass approach.

        let markdownHtml = "";
        if (typeof marked !== 'undefined') {
            markdownHtml = marked.parse(text);
        } else {
            markdownHtml = this.escapeHtml(text);
        }

        container.innerHTML = markdownHtml;

        // Render KaTeX
        if (typeof renderMathInElement !== 'undefined') {
             renderMathInElement(container, {
                delimiters: [
                    {left: '$$', right: '$$', display: true},
                    {left: '$', right: '$', display: false},
                    {left: '\\(', right: '\\)', display: false},
                    {left: '\\[', right: '\\]', display: true}
                ],
                throwOnError : false
            });
        } else if (typeof katex !== 'undefined') {
             // Manual regex replacement if auto-render not found (katex.min.js often doesn't include auto-render)
             // But let's assume standard use pattern or fallback to manual replacement if needed.
             // We will implement a basic manual render for $$ and $ if the auto-render function isn't globally available.
             this.renderLatexManual(container);
        }

        // Render Mermaid
        if (typeof mermaid !== 'undefined') {
             const mermaidBlocks = container.querySelectorAll('code.language-mermaid');
             mermaidBlocks.forEach((block, index) => {
                 const parentPre = block.parentElement; // <pre> tag
                 const code = block.textContent;
                 const id = `mermaid-${Date.now()}-${index}`;

                 // Create a div for mermaid to render into
                 const div = document.createElement('div');
                 div.id = id;
                 div.className = 'mermaid';
                 div.textContent = code;

                 // Replace pre with div
                 parentPre.replaceWith(div);
             });

             // Run mermaid
             mermaid.run({
                querySelector: '.mermaid'
             });
        }

        // Enhance links to open in new tab
        container.querySelectorAll('a').forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });

        this.scrollToBottom();
    }

    renderLatexManual(container) {
        // Basic LaTeX rendering for elements containing $...$ or $$...$$
        // This is tricky on already rendered HTML.
        // It's safer to traverse text nodes.
        const walk = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null, false);
        let node;
        const nodesToReplace = [];
        while(node = walk.nextNode()) {
            if (node.nodeValue.includes('$')) {
                nodesToReplace.push(node);
            }
        }

        nodesToReplace.forEach(node => {
            const text = node.nodeValue;
            const span = document.createElement('span');
            // Very naive regex for $$ and $
            // Note: This might break if $ is part of code or normal text.
            // But strict LaTeX delimiters usually work OK.

            // We'll replace the content with HTML rendered by KaTeX
            // Strategy: Split by $$ then by $
            // Note: This implementation is illustrative. Robust LaTeX mixed with Markdown usually requires a tokenizer.
            // But we'll do a simple "Render whole text if it looks like math" or try to substitute.

            // Actually, let's just leave it to the user to provide clean LaTeX blocks if possible.
            // Or try a simple replace.

            try {
                 // Try parsing segments
                 // $$...$$ -> Display Mode
                 // $...$ -> Inline Mode

                 // Because we are modifying the DOM, we need to be careful.
                 // Let's use a wrapper that handles the html generation.
                 let html = text.replace(/\$\$([\s\S]*?)\$\$/g, (match, tex) => {
                     return katex.renderToString(tex, { displayMode: true, throwOnError: false });
                 });

                 html = html.replace(/\$([^\$\n]+?)\$/g, (match, tex) => {
                     return katex.renderToString(tex, { displayMode: false, throwOnError: false });
                 });

                 if (html !== text) {
                     const tempDiv = document.createElement('span');
                     tempDiv.innerHTML = html;
                     node.replaceWith(tempDiv);
                 }
            } catch (e) {
                console.error("KaTeX render error", e);
            }
        });
    }

    escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    scrollToBottom() {
        const container = document.getElementById('chat-container');
        container.scrollTop = container.scrollHeight;
    }

    showError(message) {
        const div = document.createElement('div');
        div.className = 'message error-message';
        div.style.color = 'red';
        div.textContent = message;
        this.messagesList.appendChild(div);
    }

    // History UI Methods
    renderHistory(chats, currentChatId) {
        this.historyList.innerHTML = '';

        // Sort by date desc
        const sortedChats = [...chats].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        sortedChats.forEach(chat => {
            const li = document.createElement('li');
            li.className = `history-item ${chat.id === currentChatId ? 'active' : ''}`;
            li.innerHTML = `
                <span class="history-title">${this.escapeHtml(chat.title || 'New Chat')}</span>
                <div class="history-actions">
                    <button class="history-action-btn delete-btn" title="Delete">×</button>
                </div>
            `;

            // Click to load
            li.addEventListener('click', (e) => {
                if (!e.target.classList.contains('history-action-btn')) {
                    if (this.onHistoryAction) this.onHistoryAction('load', chat.id);
                    // Mobile: close sidebar
                    if (window.innerWidth <= 768) this.sidebar.classList.remove('open');
                }
            });

            // Delete action
            const deleteBtn = li.querySelector('.delete-btn');
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this chat?')) {
                    if (this.onHistoryAction) this.onHistoryAction('delete', chat.id);
                }
            });

            this.historyList.appendChild(li);
        });
    }

    clearChat() {
        this.messagesList.innerHTML = '';
        this.welcomeScreen.style.display = 'flex';
    }
}
