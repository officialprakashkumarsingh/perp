class UIHandler {
    constructor() {
        this.messagesList = document.getElementById('messages-list');
        this.userInput = document.getElementById('user-input');
        this.modelSelect = document.getElementById('model-select');
        this.sendBtn = document.getElementById('send-btn');
        this.sidebar = document.getElementById('sidebar');
        this.sidebarToggle = document.getElementById('sidebar-toggle');
        this.welcomeScreen = document.getElementById('welcome-screen');
        this.historyList = document.getElementById('history-list');
        this.newChatBtn = document.getElementById('new-chat-btn');
        this.settingsBtn = document.getElementById('settings-btn');
        this.settingsModal = document.getElementById('settings-modal');
        this.incognitoBtn = document.getElementById('incognito-btn');
        this.welcomeTitle = document.getElementById('welcome-title');
        this.fileInput = null;
        this.currentAttachment = null;
        this.onHistoryAction = null;
        this.isIncognito = false;

        // Queue Elements
        this.queuePanel = document.getElementById('queue-panel');
        this.queueList = document.getElementById('queue-list');
        this.queueCount = document.getElementById('queue-count');
        this.queueToggle = document.getElementById('queue-toggle');

        // Initialize Mermaid
        if (typeof mermaid !== 'undefined') {
            mermaid.initialize({ startOnLoad: false, theme: 'default' });
        }
    }

    init(onSubmit, onHistoryAction, onSaveSettings) {
        // Initialize Theme
        const savedTheme = localStorage.getItem('ahamai_theme') || 'system';
        this.applyTheme(savedTheme);

        // Create file input hidden
        this.fileInput = document.createElement('input');
        this.fileInput.type = 'file';
        this.fileInput.accept = '.pdf,.txt,.zip,.js,.py,.html,.css,.json,.md';
        this.fileInput.style.display = 'none';
        document.body.appendChild(this.fileInput);

        // Extension Button Logic
        const leftControls = document.querySelector('.left-controls');
        const extBtn = document.createElement('button');
        extBtn.type = 'button';
        extBtn.id = 'extension-btn';
        extBtn.className = 'attach-btn';
        extBtn.style.position = 'relative'; // For pseudo element positioning
        extBtn.innerHTML = '🧩';
        extBtn.title = 'Extensions';
        leftControls.insertBefore(extBtn, leftControls.firstChild);

        const sheet = document.getElementById('extension-sheet');

        // Toggle Sheet
        extBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            sheet.classList.toggle('open');
        });

        // Close sheet on click outside
        document.addEventListener('click', (e) => {
            if (!sheet.contains(e.target) && e.target !== extBtn) {
                sheet.classList.remove('open');
            }
        });

        // Extension Items Logic

        // Attach
        document.getElementById('sheet-attach').addEventListener('click', () => {
            this.fileInput.click();
            sheet.classList.remove('open');
        });

        // Search Toggle logic moved to sheet
        const searchSwitch = document.getElementById('search-switch');
        searchSwitch.addEventListener('change', () => this.updateExtensionIconState());

        // Study Toggle
        const studySwitch = document.getElementById('study-switch');
        studySwitch.addEventListener('change', () => this.updateExtensionIconState());

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
                this.loadSettings();
            });

            this.settingsModal.querySelector('.close-modal').addEventListener('click', () => {
                this.settingsModal.classList.remove('open');
                this.saveSettings();
            });

            // Tab Switching Logic
            const tabs = this.settingsModal.querySelectorAll('.settings-nav-item');
            const panels = this.settingsModal.querySelectorAll('.settings-content-panel');

            tabs.forEach(tab => {
                tab.addEventListener('click', () => {
                    // Deactivate all
                    tabs.forEach(t => t.classList.remove('active'));
                    panels.forEach(p => p.classList.remove('active'));

                    // Activate clicked
                    tab.classList.add('active');
                    const targetId = `tab-${tab.dataset.tab}`;
                    document.getElementById(targetId).classList.add('active');
                });
            });

            // Real-time Settings Listeners (Auto-save/Apply)
            document.getElementById('theme-select').addEventListener('change', (e) => {
                this.applyTheme(e.target.value);
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
                    this.saveSettings(); // Save on close
                }
            });
        }

        // Incognito Toggle
        if (this.incognitoBtn) {
            this.incognitoBtn.innerHTML = this.getIcon('incognito');
            this.incognitoBtn.addEventListener('click', () => {
                this.isIncognito = !this.isIncognito;
                if (this.isIncognito) {
                    // No theme change, just text and logic
                    this.incognitoBtn.style.opacity = '1';
                    if (this.welcomeTitle) this.welcomeTitle.textContent = "You are in Incognito Mode";
                } else {
                    this.incognitoBtn.style.opacity = '0.7';
                    if (this.welcomeTitle) this.welcomeTitle.textContent = "What do you want to know?";
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

        // Queue Toggle
        if (this.queueToggle) {
            this.queueToggle.addEventListener('click', () => {
                this.queueList.style.display = this.queueList.style.display === 'none' ? 'block' : 'none';
                this.queueToggle.textContent = this.queueList.style.display === 'none' ? '▲' : '▼';
            });
        }

        // Setup History Actions callbacks
        this.onHistoryAction = onHistoryAction;

        // Render Suggestions
        this.renderSuggestions(onSubmit);
    }

    submitForm(onSubmit) {
        const text = this.userInput.value.trim();
        if (!text && !this.currentAttachment) return;

        const model = this.modelSelect.value;
        const isSearchEnabled = document.getElementById('search-switch').checked;
        const isStudyMode = document.getElementById('study-switch').checked;
        const attachment = this.currentAttachment;

        this.userInput.value = '';
        this.userInput.style.height = 'auto';

        // Switch to Stop Button
        this.setStopMode(true);
        this.clearAttachment();

        // Hide welcome screen
        this.welcomeScreen.style.display = 'none';

        onSubmit(text, model, isSearchEnabled, isStudyMode, attachment);
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

        this.updateExtensionIconState();
    }

    clearChat() {
        this.messagesList.innerHTML = '';
        this.welcomeScreen.style.display = 'flex';
        this.currentAttachment = null;
        this.fileInput.value = '';
        const chip = document.getElementById('attachment-chip');
        if (chip) chip.remove();
        this.updateExtensionIconState();
        if (this.welcomeTitle) this.welcomeTitle.textContent = this.isIncognito ? "You are in Incognito Mode" : "What do you want to know?";
    }

    clearAttachment() {
        this.currentAttachment = null;
        this.fileInput.value = '';
        const chip = document.getElementById('attachment-chip');
        if (chip) chip.remove();
        this.updateExtensionIconState();
    }

    updateExtensionIconState() {
        const extBtn = document.getElementById('extension-btn');
        const isSearch = document.getElementById('search-switch').checked;
        const isStudy = document.getElementById('study-switch').checked;
        const hasFile = !!this.currentAttachment;

        if (isSearch || isStudy || hasFile) {
            extBtn.classList.add('active-dot');
        } else {
            extBtn.classList.remove('active-dot');
        }
    }

    appendUserMessage(text) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message';

        const container = document.createElement('div');
        container.className = 'user-message-container';
        container.style.flexDirection = 'column';

        const textDiv = document.createElement('div');
        textDiv.className = 'user-message';
        textDiv.textContent = text;

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'user-actions';

        const copyBtn = document.createElement('button');
        copyBtn.className = 'user-action-btn';
        copyBtn.innerHTML = this.getIcon('copy');
        copyBtn.title = 'Copy';
        copyBtn.onclick = () => navigator.clipboard.writeText(text);

        const editBtn = document.createElement('button');
        editBtn.className = 'user-action-btn';
        editBtn.innerHTML = this.getIcon('edit');
        editBtn.title = 'Edit';
        editBtn.onclick = () => {
            this.userInput.value = text;
            this.userInput.focus();
            this.userInput.style.height = 'auto';
            this.userInput.style.height = (this.userInput.scrollHeight) + 'px';
        };

        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(editBtn);

        container.appendChild(textDiv);
        container.appendChild(actionsDiv);
        msgDiv.appendChild(container);

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
        copyBtn.innerHTML = this.getIcon('copy') + ' Copy';
        copyBtn.onclick = () => {
            const text = contentDiv.innerText;
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.innerHTML = '✅ Copied';
                setTimeout(() => copyBtn.innerHTML = this.getIcon('copy') + ' Copy', 2000);
            });
        };

        // Regenerate Button
        const regenBtn = document.createElement('button');
        regenBtn.className = 'action-btn';
        regenBtn.innerHTML = this.getIcon('refresh') + ' Regenerate';
        regenBtn.onclick = onRegenerate;

        // Export PDF Button
        const pdfBtn = document.createElement('button');
        pdfBtn.className = 'action-btn';
        pdfBtn.innerHTML = this.getIcon('download') + ' Export PDF';
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

        const svgData = new XMLSerializer().serializeToString(svg);
        const svgBlob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
        const svgUrl = URL.createObjectURL(svgBlob);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement("canvas");
            const bbox = svg.getBBox();
            const width = bbox.width || svg.getBoundingClientRect().width;
            const height = bbox.height || svg.getBoundingClientRect().height;

            const scale = 2;
            canvas.width = width * scale + 20;
            canvas.height = height * scale + 20;

            const ctx = canvas.getContext("2d");
            ctx.fillStyle = "white";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.scale(scale, scale);
            ctx.drawImage(img, 10, 10, width, height);

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
                .slide h1 { font-size: 2.5rem; margin-bottom: 1rem; }
                .slide ul { margin-left: 2rem; }

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
        // Create Modal
        const modal = document.createElement('div');
        modal.className = 'preview-modal';

        const content = document.createElement('div');
        content.className = 'preview-content';

        const header = document.createElement('div');
        header.className = 'preview-header';

        const title = document.createElement('div');
        title.className = 'preview-title';
        title.innerHTML = '👁️ Preview';

        const closeBtn = document.createElement('button');
        closeBtn.className = 'preview-close';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => modal.remove();

        header.appendChild(title);
        header.appendChild(closeBtn);

        const frameContainer = document.createElement('div');
        frameContainer.className = 'preview-frame-container';

        const frame = document.createElement('iframe');
        frame.className = 'preview-frame';
        frameContainer.appendChild(frame);

        content.appendChild(header);
        content.appendChild(frameContainer);
        modal.appendChild(content);
        document.body.appendChild(modal);

        // Write content to iframe
        const doc = frame.contentWindow.document;
        doc.open();

        let htmlContent = "";
        if (lang === 'html') {
            htmlContent = code;
        } else if (lang === 'css') {
            htmlContent = `
                <html><head><style>${code}</style></head>
                <body><h1>CSS Preview</h1><p>This is a sample paragraph to demonstrate styles.</p>
                <button>Sample Button</button>
                <div class="box">Sample Box</div>
                </body></html>`;
        } else if (lang === 'js' || lang === 'javascript') {
            htmlContent = `
                <html><body>
                <h1>JS Preview</h1>
                <div id="console-output" style="background:#f4f4f4; padding:10px; border:1px solid #ddd; font-family:monospace;"></div>
                <script>
                    // Redirect console.log to div
                    const logDiv = document.getElementById('console-output');
                    const originalLog = console.log;
                    console.log = function(...args) {
                        logDiv.innerHTML += args.join(' ') + '<br>';
                        originalLog.apply(console, args);
                    };
                    try {
                        ${code}
                    } catch(e) {
                        console.log('Error: ' + e.message);
                    }
                </script>
                </body></html>`;
        }

        doc.write(htmlContent);
        doc.close();
    }

    updateQueuePanel(queue) {
        if (!this.queuePanel) return;

        if (queue.length === 0) {
            this.queuePanel.classList.add('hidden');
            return;
        }

        this.queuePanel.classList.remove('hidden');
        this.queueCount.textContent = queue.length;
        this.queueList.innerHTML = '';

        queue.forEach(item => {
            const li = document.createElement('li');
            li.className = 'queue-item';
            li.textContent = item.query.substring(0, 30) + (item.query.length > 30 ? '...' : '');
            this.queueList.appendChild(li);
        });
    }

    // History UI Methods
    renderHistory(chats, currentChatId) {
        this.historyList.innerHTML = '';

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
            pinBtn.innerHTML = this.getIcon('pin');
            pinBtn.title = chat.pinned ? 'Unpin' : 'Pin';
            pinBtn.onclick = (e) => {
                e.stopPropagation();
                if (this.onHistoryAction) this.onHistoryAction('pin', chat.id);
            };

            // Rename Button
            const renameBtn = document.createElement('button');
            renameBtn.className = 'history-action-btn';
            renameBtn.innerHTML = this.getIcon('edit');
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
            deleteBtn.innerHTML = this.getIcon('trash');
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

    renderSuggestions(onSubmit) {
        const grid = document.getElementById('suggestion-grid');
        if (!grid) return;

        const suggestions = [
            { title: 'History of AI', desc: 'Brief overview of artificial intelligence.' },
            { title: 'Explain Quantum Physics', desc: 'Simple explanation for beginners.' },
            { title: 'Write a Python Script', desc: 'To scrape a website.' },
            { title: 'Plan a Trip', desc: '3 day itinerary for Tokyo.' }
        ];

        grid.innerHTML = '';
        suggestions.forEach(s => {
            const card = document.createElement('div');
            card.className = 'suggestion-card';
            card.innerHTML = `
                <div class="suggestion-title">${s.title}</div>
                <div class="suggestion-desc">${s.desc}</div>
            `;
            card.onclick = () => {
                this.userInput.value = s.title + " " + s.desc;
                this.userInput.style.height = 'auto'; // trigger resize
                // this.userInput.focus(); // Optional
                this.submitForm(onSubmit);
            };
            grid.appendChild(card);
        });
    }

    loadSettings() {
        document.getElementById('theme-select').value = localStorage.getItem('ahamai_theme') || 'system';
        document.getElementById('language-select').value = localStorage.getItem('ahamai_language') || 'en';
        document.getElementById('custom-instructions').value = localStorage.getItem('ahamai_custom_instructions') || '';
        document.getElementById('tone-select').value = localStorage.getItem('ahamai_tone') || 'neutral';
    }

    saveSettings() {
        const theme = document.getElementById('theme-select').value;
        const language = document.getElementById('language-select').value;
        const instructions = document.getElementById('custom-instructions').value;
        const tone = document.getElementById('tone-select').value;

        localStorage.setItem('ahamai_theme', theme);
        localStorage.setItem('ahamai_language', language);
        localStorage.setItem('ahamai_custom_instructions', instructions);
        localStorage.setItem('ahamai_tone', tone);
    }

    applyTheme(theme) {
        // Simple theme implementation
        document.body.classList.remove('dark-theme', 'amoled-theme', 'cream-orange-theme');

        if (theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.body.classList.add('dark-theme');
        } else if (theme === 'amoled') {
            document.body.classList.add('amoled-theme');
        } else if (theme === 'cream-orange') {
            document.body.classList.add('cream-orange-theme');
        }

        // Persist override if explicitly set
        if (theme !== 'system') localStorage.setItem('ahamai_theme', theme);
    }

    getIcon(name) {
        const icons = {
            'copy': '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>',
            'edit': '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>',
            'refresh': '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>',
            'download': '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>',
            'pin': '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="17" x2="12" y2="22"></line><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24Z"></path></svg>',
            'trash': '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>',
            'incognito': '<svg class="icon-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12h20"></path><path d="M9.5 12c0 2.2-1.8 4-4 4s-4-1.8-4-4"></path><path d="M14.5 12c0 2.2 1.8 4 4 4s4-1.8 4-4"></path><path d="M12 12v-3"></path><path d="M12 9c-3 0-4-3-4-3h8s-1 3-4 3z"></path></svg>'
        };
        return icons[name] || '';
    }
}
