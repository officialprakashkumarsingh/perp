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
        this.fileInput.accept = '.pdf,.txt,.zip,.js,.py,.html,.css,.json,.md';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);

        // Attach Button Logic
        const leftControls = document.querySelector('.left-controls');
        const attachBtn = document.createElement('button');
        attachBtn.type = 'button';
        attachBtn.className = 'attach-btn';
        attachBtn.innerHTML = '+'; // Or a clip icon SVG
        attachBtn.title = 'Attach File';
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
                // Check if it's send or stop mode
                // Actually button disabled state handles "Send" logic blocking
                // But "Stop" logic is triggered by click.
                // If user presses enter while streaming, maybe stop?
                // Standard behavior is usually do nothing or stop.
                // We'll stick to button click for Stop to avoid accidental Enter stops.
                if (!this.sendBtn.disabled && !this.sendBtn.classList.contains('stop-btn')) {
                    this.submitForm(onSubmit);
                }
            }
        });

        // Form Submit
        document.getElementById('input-form').addEventListener('submit', (e) => {
            e.preventDefault();
            // Handle Stop Logic if button is in stop mode
            if (this.sendBtn.classList.contains('stop-btn')) {
                if (this.onStop) this.onStop();
            } else {
                this.submitForm(onSubmit);
            }
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
                // Render Integrations (refresh state)
                this.renderIntegrations();
            });

            this.settingsModal.querySelector('.close-modal').addEventListener('click', () => {
                this.settingsModal.classList.remove('open');
            });

            this.settingsModal.querySelector('#save-settings-btn').addEventListener('click', () => {
                const instructions = document.getElementById('custom-instructions').value;
                if (onSaveSettings) onSaveSettings(instructions);
                this.settingsModal.classList.remove('open');
            });

            // Data Controls
            document.getElementById('export-all-btn').addEventListener('click', () => {
                const chats = JSON.parse(localStorage.getItem('ahamai_chats') || '[]');
                const blob = new Blob([JSON.stringify(chats, null, 2)], {type : 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `ahamai-backup-${Date.now()}.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            });

            document.getElementById('delete-all-btn').addEventListener('click', () => {
                if (confirm("Are you sure you want to delete ALL chats? This cannot be undone.")) {
                    if (this.onHistoryAction) this.onHistoryAction('delete_all');
                    this.settingsModal.classList.remove('open');
                }
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

        // Switch to Stop Button
        this.setStopMode(true);
        this.clearAttachment();

        // Hide welcome screen
        this.welcomeScreen.style.display = 'none';

        onSubmit(text, model, isSearchEnabled, attachment);
    }

    setStopMode(isStop) {
        this.sendBtn.disabled = false; // Always enabled to allow interaction
        if (isStop) {
            this.sendBtn.classList.add('stop-btn');
            this.sendBtn.innerHTML = `
                <svg class="stop-icon-svg" viewBox="0 0 24 24">
                    <rect x="6" y="6" width="12" height="12" rx="2" ry="2"></rect>
                </svg>
            `;
            this.sendBtn.title = "Stop Generating";
        } else {
            this.sendBtn.classList.remove('stop-btn');
            this.sendBtn.innerHTML = '<span class="arrow-icon">→</span>';
            this.sendBtn.title = "Send";
            this.sendBtn.disabled = this.userInput.value.trim().length === 0;
        }
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

        // Structure: Sources (optional) + Content + Actions
        const sourcesDiv = document.createElement('div');
        sourcesDiv.className = 'sources-section';
        sourcesDiv.style.display = 'none'; // Hidden initially

        const contentDiv = document.createElement('div');
        contentDiv.className = 'bot-message-container';

        const textDiv = document.createElement('div');
        textDiv.className = 'bot-message-content';

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'message-actions';
        actionsDiv.style.display = 'none'; // Hidden until complete

        contentDiv.appendChild(textDiv);
        msgDiv.appendChild(sourcesDiv);
        msgDiv.appendChild(contentDiv);
        msgDiv.appendChild(actionsDiv);

        this.messagesList.appendChild(msgDiv);
        this.scrollToBottom();

        return { messageDiv: msgDiv, sourcesDiv, contentDiv: textDiv, actionsDiv };
    }

    addMessageActions(actionsDiv, contentDiv, onRegenerate) {
        actionsDiv.style.display = 'flex';
        actionsDiv.innerHTML = ''; // Clear previous

        // Copy Button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'action-btn';
        copyBtn.innerHTML = '📋 Copy';
        copyBtn.onclick = () => {
            const text = contentDiv.innerText;
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.innerHTML = '✅ Copied';
                setTimeout(() => copyBtn.innerHTML = '📋 Copy', 2000);
            });
        };

        // Regenerate Button
        const regenBtn = document.createElement('button');
        regenBtn.className = 'action-btn';
        regenBtn.innerHTML = '🔄 Regenerate';
        regenBtn.onclick = onRegenerate;

        // Export PDF Button
        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'action-btn';
        pdfBtn.innerHTML = '📄 Export PDF';
        pdfBtn.onclick = () => this.exportMessageToPDF(contentDiv);

        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(regenBtn);
        actionsDiv.appendChild(pdfBtn);

        this.scrollToBottom();
    }

    exportMessageToPDF(element) {
        if (typeof html2pdf === 'undefined') return;

        const opt = {
            margin: 1,
            filename: `ahamai-response-${Date.now()}.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        html2pdf().set(opt).from(element).save();
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

        // Presentation Detection
        if (text.includes('<div class="slide">')) {
            // Check if preview button exists
            if (!container.querySelector('.presentation-preview-btn')) {
                const previewBtn = document.createElement('button');
                previewBtn.className = 'presentation-preview-btn';
                previewBtn.innerHTML = '🎬 Preview Presentation';
                previewBtn.onclick = () => this.showPresentationPreview(text);
                container.insertBefore(previewBtn, container.firstChild);
            }
        }

        // Code Block Preview
        const codeBlocks = container.querySelectorAll('pre code');
        codeBlocks.forEach(code => {
            const pre = code.parentElement;
            if (pre.querySelector('.code-header')) return; // Already processed

            const lang = code.className.replace('language-', '');
            if (['html', 'css', 'javascript', 'js'].includes(lang)) {
                // Wrap content
                const header = document.createElement('div');
                header.className = 'code-header';

                const previewBtn = document.createElement('button');
                previewBtn.className = 'code-preview-btn';
                previewBtn.innerHTML = '👁️ Preview';
                previewBtn.onclick = () => this.showCodePreview(code.textContent, lang);

                header.appendChild(previewBtn);
                pre.insertBefore(header, code);
            }
        });

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
             // Ensure the selector targets the specific container to avoid re-rendering existing diagrams incorrectly
             // But mermaid.run with querySelector targets all matching elements.
             // We can use a specific ID if we want, but let's try just targeting .mermaid inside container
             // However, querySelector in run takes a global selector string.

             // The issue might be that mermaid.run is async and we need to wait for it.
             // Also, if we call it multiple times, it might be tricky.
             // Let's try to target specific nodes.

             // Workaround: We already replaced pre with div.mermaid.
             // We can pass the nodes directly if supported, or just use class selector.

             mermaid.run({
                nodes: container.querySelectorAll('.mermaid')
             }).then(() => {
                 // Add export buttons to generated diagrams
                 const processedBlocks = container.querySelectorAll('.mermaid');
                 processedBlocks.forEach(block => {
                     // Check if SVG exists (rendered)
                     if (!block.querySelector('svg')) return;

                     // Check if already has button
                     if (block.parentElement.classList.contains('diagram-container')) return;

                     // Wrap in container
                     const wrapper = document.createElement('div');
                     wrapper.className = 'diagram-container';

                     // Insert wrapper before block
                     block.parentNode.insertBefore(wrapper, block);
                     // Move block into wrapper
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

        // Simplify export: Convert SVG directly to Data URL if possible, or use simpler canvas approach
        // The issue with previous approach might be styles not being inline.
        // Let's try to clone the node and ensure styles are computed?
        // Or simpler: Just download the SVG itself if PNG is tricky without external libs like canvg.
        // But user asked for image export. Canvas "tainted" is common issue if using external fonts/images.
        // Since we have no external images in mermaid usually, it should be fine.
        // Let's try explicitly setting width/height on SVG to avoid 0 size issues.

        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
        const svgUrl = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            // Use actual SVG viewbox or width/height if set
            const bbox = svg.getBBox();
            // Fallback to bounding client rect if getBBox is zero (happens if not in DOM or hidden)
            const width = bbox.width || svg.getBoundingClientRect().width;
            const height = bbox.height || svg.getBoundingClientRect().height;

            const scale = 2;
            canvas.width = width * scale + 20; // Add padding
            canvas.height = height * scale + 20;

            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(scale, scale);
            ctx.drawImage(img, 10, 10, width, height); // Centered with padding

            URL.revokeObjectURL(svgUrl);

            const a = document.createElement("a");
            a.download = `diagram-${Date.now()}.png`;
            a.href = canvas.toDataURL("image/png");
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };
        img.src = svgUrl;
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

    showPresentationPreview(html) {
        // Create a full-screen modal
        const modal = document.createElement('div');
        modal.className = 'presentation-modal';
        modal.innerHTML = `
            <div class="presentation-controls">
                <button class="close-pres">Close</button>
                <button class="export-pres">Export PDF</button>
            </div>
            <div class="slides-container" id="slides-root">
                ${html} <!-- Contains <div class="slide"> elements -->
            </div>
            <style>
                .presentation-modal {
                    position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
                    background: #333; z-index: 2000; overflow-y: auto;
                    display: flex; flex-direction: column; align-items: center;
                }
                .presentation-controls {
                    width: 100%; padding: 1rem; background: rgba(0,0,0,0.5);
                    display: flex; justify-content: flex-end; gap: 1rem; position: sticky; top: 0;
                }
                .slides-container {
                    width: 80%; max-width: 960px; padding: 2rem;
                }
                .slide {
                    background: white; color: black; padding: 2rem; margin-bottom: 2rem;
                    border-radius: 8px; min-height: 540px; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                    page-break-after: always;
                }
                /* Basic reset inside slides */
                .slide h1 { font-size: 2.5rem; margin-bottom: 1rem; }
                .slide ul { margin-left: 2rem; }

                /* Theme Awareness */
                body.amoled-theme .slide {
                    background: #000; color: #fff; border: 1px solid #333;
                }
            </style>
        `;
        document.body.appendChild(modal);

        modal.querySelector('.close-pres').onclick = () => modal.remove();
        modal.querySelector('.export-pres').onclick = () => {
             const element = document.getElementById('slides-root');
             const opt = {
                margin: 0,
                filename: 'presentation.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2 },
                jsPDF: { unit: 'in', format: 'letter', orientation: 'landscape' }
            };
            html2pdf().set(opt).from(element).save();
        };
    }

    showCodePreview(code, lang) {
        const win = window.open("", "Code Preview", "width=800,height=600");
        let content = "";
        if (lang === 'html') content = code;
        else if (lang === 'css') content = `<style>${code}</style><h1>CSS Preview</h1>`;
        else if (lang === 'js' || lang === 'javascript') content = `<script>${code}<\/script><h1>JS Executed (Check Console)</h1>`;

        win.document.write(content);
        win.document.close();
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

    renderIntegrations() {
        const grid = document.getElementById('integrations-grid');
        if (!grid) return;
        grid.innerHTML = '';

        const integrations = [
            { id: 'wikipedia', name: 'Wikipedia', icon: '📚' },
            { id: 'duckduckgo', name: 'DuckDuckGo', icon: '🦆' },
            { id: 'weather', name: 'Weather', icon: '🌦️' },
            { id: 'hackernews', name: 'HackerNews', icon: '📰' }
        ];

        // Load state
        const enabled = JSON.parse(localStorage.getItem('ahamai_integrations') || '{}');

        integrations.forEach(integration => {
            const card = document.createElement('div');
            card.className = `integration-card ${enabled[integration.id] ? 'active' : ''}`;
            card.innerHTML = `
                <div class="integration-toggle"></div>
                <div class="integration-icon">${integration.icon}</div>
                <div class="integration-name">${integration.name}</div>
            `;

            card.addEventListener('click', () => {
                const newState = !enabled[integration.id];
                enabled[integration.id] = newState;
                localStorage.setItem('ahamai_integrations', JSON.stringify(enabled));

                // Toggle UI
                if (newState) card.classList.add('active');
                else card.classList.remove('active');
            });

            grid.appendChild(card);
        });
    }
}
