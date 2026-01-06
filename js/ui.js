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
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.fileInput = null;
        this.currentAttachment = null;
        this.onHistoryAction = null;

        // Initialize Mermaid
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({ startOnLoad: false, theme: 'default' });
        }
    }

    init(onSubmit, onHistoryAction, onSaveSettings) {
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

        // Settings Modal
        if (this.settingsBtn && this.settingsModal) {
            this.settingsBtn.addEventListener('click', () => {
                this.settingsModal.classList.add('open');
                const savedInstructions = localStorage.getItem('ahamai_custom_instructions') || '';
                document.getElementById('custom-instructions').value = savedInstructions;
            });

            this.settingsModal.querySelector('.close-modal').addEventListener('click', () => {
                this.settingsModal.classList.remove('open');
            });

            this.settingsModal.querySelector('#save-settings-btn').addEventListener('click', () => {
                const instructions = document.getElementById('custom-instructions').value;
                if (onSaveSettings) onSaveSettings(instructions);
                this.settingsModal.classList.remove('open');
            });

            window.addEventListener('click', (e) => {
                if (e.target === this.settingsModal) {
                    this.settingsModal.classList.remove('open');
                }
            });
        }

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
             }).then(() => {
                 // Add export buttons to generated diagrams
                 const processedBlocks = container.querySelectorAll('.mermaid');
                 processedBlocks.forEach(block => {
                     // Check if already has button
                     if (block.parentElement.classList.contains('diagram-container')) return;

                     // Wrap in container
                     const wrapper = document.createElement('div');
                     wrapper.className = 'diagram-container';
                     block.parentNode.insertBefore(wrapper, block);
                     wrapper.appendChild(block);

                     // Add button
                     const btn = document.createElement('button');
                     btn.className = 'export-btn';
                     btn.innerHTML = '⬇️ Export';
                     btn.onclick = () => this.exportDiagram(block);
                     wrapper.appendChild(btn);
                 });
             });
        }

        // Enhance links to open in new tab
        container.querySelectorAll('a').forEach(link => {
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener noreferrer');
        });

        this.scrollToBottom();
    }

    exportDiagram(block) {
        const svg = block.querySelector('svg');
        if (!svg) return;

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const svgData = new XMLSerializer().serializeToString(svg);
        const img = new Image();

        // Get dimensions
        const bbox = svg.getBoundingClientRect();
        // Use a scale factor for higher resolution
        const scale = 2;
        canvas.width = bbox.width * scale;
        canvas.height = bbox.height * scale;

        // Handle SVG loading
        const svgBlob = new Blob([svgData], {type: 'image/svg+xml;charset=utf-8'});
        const url = URL.createObjectURL(svgBlob);

        img.onload = () => {
            ctx.scale(scale, scale);
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, canvas.width/scale, canvas.height/scale);
            ctx.drawImage(img, 0, 0);
            URL.revokeObjectURL(url);

            // Trigger download
            const a = document.createElement('a');
            a.download = `diagram-${Date.now()}.png`;
            a.href = canvas.toDataURL('image/png');
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
        img.src = url;
    }

    renderLatexManual(container) {
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
            try {
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

        // Sort: Pinned first, then by date (desc)
        const sortedChats = [...chats].sort((a, b) => {
            if (a.pinned && !b.pinned) return -1;
            if (!a.pinned && b.pinned) return 1;
            return new Date(b.timestamp) - new Date(a.timestamp);
        });

        sortedChats.forEach(chat => {
            const li = document.createElement('li');
            li.className = `history-item ${chat.id === currentChatId ? 'active' : ''} ${chat.pinned ? 'pinned' : ''}`;

            const span = document.createElement('span');
            span.className = 'history-title';
            span.textContent = chat.title || 'New Chat';
            span.title = chat.title || 'New Chat';

            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'history-actions';

            // Pin Button
            const pinBtn = document.createElement('button');
            pinBtn.className = 'history-action-btn';
            pinBtn.innerHTML = chat.pinned ? '📍' : '📌';
            pinBtn.title = chat.pinned ? 'Unpin' : 'Pin';
            pinBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.onHistoryAction) this.onHistoryAction('pin', chat.id);
            };

            // Rename Button
            const renameBtn = document.createElement('button');
            renameBtn.className = 'history-action-btn';
            renameBtn.innerHTML = '✏️';
            renameBtn.title = 'Rename';
            renameBtn.onclick = (e) => {
                e.stopPropagation();
                const newTitle = prompt("Rename chat:", chat.title);
                if (newTitle) {
                     if (this.onHistoryAction) this.onHistoryAction('rename', chat.id, newTitle);
                }
            };

            // Delete action
            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'history-action-btn delete-btn';
            deleteBtn.innerHTML = '🗑️';
            deleteBtn.title = 'Delete';
            deleteBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (confirm('Delete this chat?')) {
                    if (this.onHistoryAction) this.onHistoryAction('delete', chat.id);
                }
            });

            actionsDiv.appendChild(pinBtn);
            actionsDiv.appendChild(renameBtn);
            actionsDiv.appendChild(deleteBtn);

            li.appendChild(span);
            li.appendChild(actionsDiv);

            // Click to load
            li.addEventListener('click', (e) => {
                if (!e.target.closest('.history-actions')) {
                    if (this.onHistoryAction) this.onHistoryAction('load', chat.id);
                    // Mobile: close sidebar
                    if (window.innerWidth <= 768) this.sidebar.classList.remove('open');
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
