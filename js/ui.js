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
        this.onDeleteChat = null;
        this.onLoadChat = null;
    }

    init(onSubmit, onHistoryAction) {
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
        if (!text) return;

        const model = this.modelSelect.value;
        const isSearchEnabled = this.searchToggle.getAttribute('aria-pressed') === 'true';

        this.userInput.value = '';
        this.userInput.style.height = 'auto';
        this.sendBtn.disabled = true;

        // Hide welcome screen
        this.welcomeScreen.style.display = 'none';

        onSubmit(text, model, isSearchEnabled);
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
        // Using marked.js for full markdown support
        if (typeof marked !== 'undefined') {
            container.innerHTML = marked.parse(text);
        } else {
            container.textContent = text; // Fallback
        }

        // Enhance links to open in new tab
        container.querySelectorAll('a').forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });

        this.scrollToBottom();
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
