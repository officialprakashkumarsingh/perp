document.addEventListener('DOMContentLoaded', () => {
    const apiHandler = new APIHandler();
    const uiHandler = new UIHandler();

    // Expose for testing/debugging
    window.uiHandler = uiHandler;
    window.apiHandler = apiHandler;

    // Chat History Manager
    const chatManager = {
        chats: JSON.parse(localStorage.getItem('ahamai_chats') || '[]'),
        currentChatId: null,

        saveChats() {
            localStorage.setItem('ahamai_chats', JSON.stringify(this.chats));
            uiHandler.renderHistory(this.chats, this.currentChatId);
        },

        createChat() {
            const newChat = {
                id: Date.now().toString(),
                title: 'New Thread',
                messages: [],
                timestamp: new Date().toISOString()
            };
            this.chats.unshift(newChat);
            this.currentChatId = newChat.id;
            this.saveChats();
            return newChat;
        },

        getChat(id) {
            return this.chats.find(c => c.id === id);
        },

        deleteChat(id) {
            this.chats = this.chats.filter(c => c.id !== id);
            if (this.currentChatId === id) {
                this.currentChatId = null;
                uiHandler.clearChat();
            }
            this.saveChats();
        },

        updateChat(id, data) {
            const chat = this.getChat(id);
            if (chat) {
                Object.assign(chat, data);
                this.saveChats();
            }
        },

        addMessageToChat(id, message) {
            const chat = this.getChat(id);
            if (chat) {
                chat.messages.push(message);
                // Update title if it's the first user message
                if (chat.messages.length === 2 && message.role === 'user') { // System msg is 0? No, usually not stored.
                     // Actually let's just use the first user message as title
                }
                // If it's the first user message (length 1 or 2 depending on if we store system), set title
                const userMsgs = chat.messages.filter(m => m.role === 'user');
                if (userMsgs.length === 1 && message.role === 'user') {
                    chat.title = message.content.substring(0, 30) + (message.content.length > 30 ? '...' : '');
                }
                this.saveChats();
            }
        }
    };

    // Load initial history
    uiHandler.renderHistory(chatManager.chats, null);

    const handleHistoryAction = (action, id, payload) => {
        if (action === 'new') {
            chatManager.currentChatId = null;
            uiHandler.clearChat();
            // Don't create entry yet, wait for first message
            uiHandler.renderHistory(chatManager.chats, null);
        } else if (action === 'load') {
            const chat = chatManager.getChat(id);
            if (chat) {
                chatManager.currentChatId = id;
                uiHandler.clearChat();
                uiHandler.welcomeScreen.style.display = 'none';

                // Replay messages
                chat.messages.forEach(msg => {
                    if (msg.role === 'user') {
                        // Strip attachment text for display if possible, or just show full
                        // Since we append attachment text to content, we might show it.
                        // Ideally we'd store display text separately, but for now simple replay:
                        uiHandler.appendUserMessage(msg.content);
                    } else if (msg.role === 'assistant') {
                        const { messageDiv, sourcesDiv, contentDiv } = uiHandler.createBotMessageContainer();
                        if (msg.sources) {
                            uiHandler.renderSources(sourcesDiv, msg.sources);
                        }
                        uiHandler.updateBotMessage(contentDiv, msg.content);
                    }
                });
                uiHandler.renderHistory(chatManager.chats, id);
            }
        } else if (action === 'delete') {
            chatManager.deleteChat(id);
        } else if (action === 'pin') {
            const chat = chatManager.getChat(id);
            if (chat) {
                chat.pinned = !chat.pinned;
                chatManager.saveChats();
            }
        } else if (action === 'rename') {
            const chat = chatManager.getChat(id);
            if (chat) {
                chat.title = payload; // payload is newTitle
                chatManager.saveChats();
            }
        }
    };

    const handleSaveSettings = (instructions) => {
        localStorage.setItem('ahamai_custom_instructions', instructions);
        // Optionally notify user
        // uiHandler.showToast('Settings saved');
    };

    const handleUserSubmit = async (query, model, isSearchEnabled, attachment) => {
        // Ensure we have a chat session
        if (!chatManager.currentChatId) {
            const newChat = chatManager.createChat();
            chatManager.currentChatId = newChat.id;
        }

        let displayMessage = query;
        if (attachment) {
            displayMessage = `[Attachment: ${attachment.name}] ${query}`;
        }

        uiHandler.appendUserMessage(displayMessage);

        // Handle PDF Text Extraction
        let attachmentText = "";
        if (attachment) {
            try {
                if (typeof extractTextFromPDF !== 'undefined') {
                    const text = await extractTextFromPDF(attachment);
                    attachmentText = `\n\n--- Attachment Content (${attachment.name}) ---\n${text}\n--- End Attachment ---\n`;
                } else {
                    attachmentText = `\n\n[System: Failed to load PDF extraction library.]`;
                }
            } catch (e) {
                attachmentText = `\n\n[System: Failed to read attachment: ${e.message}]`;
            }
        }

        const fullUserContent = query + attachmentText;

        chatManager.addMessageToChat(chatManager.currentChatId, { role: 'user', content: fullUserContent });

        const { messageDiv, sourcesDiv, contentDiv } = uiHandler.createBotMessageContainer();
        const loadingDiv = uiHandler.showLoading(contentDiv);

        let finalAnswer = "";
        let sources = [];

        try {
            // 1. Search Web (if enabled)
            let searchContext = "";
            if (isSearchEnabled && query.trim().length > 0) { // Only search if there is a query
                try {
                    const searchResults = await apiHandler.searchWeb(query);
                    sources = searchResults;
                    uiHandler.renderSources(sourcesDiv, searchResults);

                    if (searchResults && searchResults.length > 0) {
                        searchContext = "\n\nUse the following search results to answer the user's question:\n";
                        searchResults.forEach((result, index) => {
                            searchContext += `[${index + 1}] ${result.title}: ${result.description}\nURL: ${result.url}\n\n`;
                        });
                        searchContext += "Cite the sources using [number] notation where appropriate.";
                    }
                } catch (searchError) {
                    console.error("Search failed, continuing without sources", searchError);
                    searchContext = "\n(Web search failed, please answer based on internal knowledge)";
                }
            }

            // 2. Prepare Context with Date/Time and Capabilities
            const currentDate = new Date().toLocaleString();
            let systemPrompt = `Current Date and Time: ${currentDate}. You are AhamAI, a helpful AI assistant.

Capabilities:
1. **Diagrams**: You can generate diagrams, flowcharts, graphs, and visualizations using Mermaid.js. When a user asks for a diagram, output a code block with the language set to \`mermaid\`.
   Example:
   \`\`\`mermaid
   graph TD;
     A-->B;
   \`\`\`
2. **Math & Science**: You can render mathematical and chemical formulas using LaTeX. Use standard LaTeX delimiters: $ for inline math and $$ for display math.
   Example: The area is $A = \pi r^2$.

3. **Attachments**: The user may provide text from attached PDF files. Use this context to answer questions.

Instructions:
- If the user asks to "draw" or "visualize" something, ALWAYS provide a Mermaid diagram if possible.
- Be concise and helpful.
`;
            // Add Custom Instructions
            const customInstructions = localStorage.getItem('ahamai_custom_instructions');
            if (customInstructions && customInstructions.trim()) {
                systemPrompt += `\n\nUSER CUSTOM INSTRUCTIONS (MUST FOLLOW):\n${customInstructions.trim()}\n`;
            }

            if (searchContext) {
                systemPrompt += searchContext;
            } else {
                systemPrompt += " Answer the user's question to the best of your ability.";
            }

            // Build message history for context (limit to last few turns to save tokens if needed)
            const chat = chatManager.getChat(chatManager.currentChatId);
            const historyMessages = chat.messages.map(m => ({
                role: m.role,
                content: m.content
            })).slice(-10); // Last 10 messages

            // Remove the last user message we just added locally from historyMessages because we want to construct the prompt freshly?
            // actually historyMessages includes the one we just pushed.
            // But we need to insert system prompt at start.

            const messages = [
                { role: "system", content: systemPrompt },
                ...historyMessages
            ];

            // 3. Call LLM
            uiHandler.removeLoading(loadingDiv);

            // Stream response
            let fullResponse = "";
            await apiHandler.chatCompletion(messages, model, (chunk) => {
                fullResponse += chunk;
                uiHandler.updateBotMessage(contentDiv, fullResponse);
            });

            finalAnswer = fullResponse;

        } catch (error) {
            uiHandler.removeLoading(loadingDiv);
            uiHandler.showError(`An error occurred: ${error.message}`);
            console.error(error);
            finalAnswer = "Error generating response.";
        }

        // Save assistant response
        chatManager.addMessageToChat(chatManager.currentChatId, {
            role: 'assistant',
            content: finalAnswer,
            sources: sources
        });
    };

    uiHandler.init(handleUserSubmit, handleHistoryAction, handleSaveSettings);
});
