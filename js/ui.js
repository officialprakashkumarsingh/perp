class UIHandler {
    constructor() {
        this.chatContainer = document.getElementById('chat-container');
        this.inputForm = document.getElementById('input-form');
        this.inputField = document.getElementById('user-input');
        this.modelSelect = document.getElementById('model-select');
    }

    init(onSubmit) {
        // Populate model selector
        CONFIG.MODELS.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = model;
            this.modelSelect.appendChild(option);
        });

        this.inputForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const query = this.inputField.value.trim();
            if (query) {
                this.inputField.value = '';
                onSubmit(query, this.modelSelect.value);
            }
        });

        // Auto-resize textarea
        this.inputField.addEventListener('input', () => {
             this.inputField.style.height = 'auto';
             this.inputField.style.height = (this.inputField.scrollHeight) + 'px';
        });
    }

    appendUserMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message user-message';
        messageDiv.textContent = message;
        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
    }

    createBotMessageContainer() {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message bot-message';

        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'sources-container';
        messageDiv.appendChild(sourcesDiv);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        messageDiv.appendChild(contentDiv);

        this.chatContainer.appendChild(messageDiv);
        this.scrollToBottom();
        return { messageDiv, sourcesDiv, contentDiv };
    }

    updateBotMessage(contentDiv, text) {
        // Simple markdown parsing could go here, for now just text
        // Using innerHTML to allow basic formatting if needed, but need to be careful with XSS.
        // For this task, plain text appending is safer and simpler, but I'll replace newlines with <br>
        contentDiv.innerHTML += text.replace(/\n/g, '<br>');
        this.scrollToBottom();
    }

    renderSources(sourcesDiv, sources) {
        if (!sources || sources.length === 0) return;

        const sourcesTitle = document.createElement('div');
        sourcesTitle.className = 'sources-title';
        sourcesTitle.textContent = 'Sources';
        sourcesDiv.appendChild(sourcesTitle);

        const list = document.createElement('div');
        list.className = 'sources-list';

        sources.forEach((source, index) => {
            const item = document.createElement('a');
            item.href = source.url;
            item.target = '_blank';
            item.className = 'source-item';

            const favicon = document.createElement('img');
            favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(source.url).hostname}`;
            favicon.className = 'source-icon';

            const title = document.createElement('span');
            title.textContent = source.title.length > 30 ? source.title.substring(0, 30) + '...' : source.title;
            title.className = 'source-title-text';

            const indexSpan = document.createElement('span');
            indexSpan.textContent = index + 1;
            indexSpan.className = 'source-index';

            item.appendChild(indexSpan);
            item.appendChild(favicon);
            item.appendChild(title);
            list.appendChild(item);
        });
        sourcesDiv.appendChild(list);
    }

    showLoading(container) {
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'loading-indicator';
        loadingDiv.textContent = 'Thinking...';
        container.appendChild(loadingDiv);
        return loadingDiv;
    }

    removeLoading(loadingDiv) {
        if (loadingDiv && loadingDiv.parentNode) {
            loadingDiv.parentNode.removeChild(loadingDiv);
        }
    }

    scrollToBottom() {
        this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message error-message';
        errorDiv.textContent = message;
        this.chatContainer.appendChild(errorDiv);
        this.scrollToBottom();
    }
}
