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

    // Check Theme
    if (localStorage.getItem('ahamai_theme') === 'amoled') {
        document.body.classList.add('amoled-theme');
    }

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
        } else if (action === 'delete_all') {
            chatManager.chats = [];
            chatManager.currentChatId = null;
            chatManager.saveChats();
            uiHandler.clearChat();
        }
    };

    const handleSaveSettings = (instructions) => {
        localStorage.setItem('ahamai_custom_instructions', instructions);
    };

    const handleUserSubmit = async (query, model, isSearchEnabled, isStudyMode, attachment) => {
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

        // Handle File Text Extraction
        let attachmentText = "";
        if (attachment) {
            try {
                if (typeof extractTextFromFile !== 'undefined') {
                    const text = await extractTextFromFile(attachment);
                    attachmentText = `\n\n--- Attachment Content (${attachment.name}) ---\n${text}\n--- End Attachment ---\n`;
                } else {
                    attachmentText = `\n\n[System: Failed to load file extraction library.]`;
                }
            } catch (e) {
                attachmentText = `\n\n[System: Failed to read attachment: ${e.message}]`;
            }
        }

        // Handle URL Reading
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const urls = query.match(urlRegex);
        let urlContext = "";

        if (urls && urls.length > 0) {
            for (const url of urls) {
                try {
                    const content = await apiHandler.fetchPageContent(url);
                    if (content) {
                        urlContext += `\n\n--- Content from ${url} ---\n${content}\n--- End Content ---\n`;
                    }
                } catch (e) {
                    console.error("Error reading URL", e);
                }
            }
        }

        const fullUserContent = query + attachmentText + urlContext;

        // Only save if not incognito
        if (!uiHandler.isIncognito) {
            chatManager.addMessageToChat(chatManager.currentChatId, { role: 'user', content: fullUserContent });
        }

        const { messageDiv, sourcesDiv, contentDiv, actionsDiv } = uiHandler.createBotMessageContainer();
        const loadingDiv = uiHandler.showLoading(contentDiv);

        let finalAnswer = "";
        let sources = [];
        let abortController = new AbortController();

        // Hook up Stop Logic
        uiHandler.onStop = () => {
            if (abortController) {
                abortController.abort();
                uiHandler.setStopMode(false);
                uiHandler.removeLoading(loadingDiv);
                // Finalize what we have
                chatManager.addMessageToChat(chatManager.currentChatId, {
                    role: 'assistant',
                    content: finalAnswer + "\n[Stopped by user]",
                    sources: sources
                });
            }
        };

        try {
            // 1. Search Web (if enabled)
            let searchContext = "";
            if (isSearchEnabled && query.trim().length > 0) {
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

3. **Attachments**: The user may provide text from attached files (PDF, code, text, zip). Use this context to answer questions.

4. **Image Generation**: You can generate images using Pollinations AI.
   To generate an image, you MUST use this exact Markdown format:
   \`![Image Description](https://image.pollinations.ai/prompt/{description}?nologo=true)\`
   Replace \`{description}\` with a URL-encoded detailed prompt for the image.
   Example: \`![A futuristic city](https://image.pollinations.ai/prompt/futuristic%20city%20sunset?nologo=true)\`
   Do NOT use any other API or format. Generate images when the user explicitly asks or when it adds significant value.

5. **Presentations**: You can generate stylish, themed presentations.
   To do this, output a single HTML block containing multiple \`<div class="slide">\` elements.
   Each slide should have inline CSS for styling (backgrounds, fonts, colors) based on the topic.
   Do not use \`<html>\` or \`<body>\` tags, just the divs.
   Example:
   \`\`\`html
   <div class="slide" style="background:linear-gradient(135deg, #1e3c72, #2a5298); color:white;">
     <h1>Title</h1>
     <ul><li>Point 1</li></ul>
   </div>
   <div class="slide" style="...">...</div>
   \`\`\`

6. **Screenshots**: You can show screenshots of websites.
   To display a screenshot, output a Markdown image using the WordPress mShots API:
   \`![Screenshot of URL](https://s0.wp.com/mshots/v1/{ENCODED_URL}?w=400&h=800)\`
   You MUST URL-encode the target URL.
   Example for google.com: \`![Screenshot of Google](https://s0.wp.com/mshots/v1/https%3A%2F%2Fwww.google.com?w=400&h=800)\`
   Use this when the user asks for a screenshot or visual of a specific web page.

Instructions:
- If the user asks to "draw" or "visualize" a system, process, or chart, ALWAYS provide a Mermaid diagram.
- If the user asks to "generate an image" or "show a picture", use the Pollinations AI markdown format.
- If the user asks for a "presentation" or "slides", generate the HTML slide format described above.
- Be concise and helpful.
`;

            // Study Together Mode Logic
            if (isStudyMode) {
                systemPrompt = `Current Date and Time: ${currentDate}. You are AhamAI Study Partner.

Role: You are an engaging, gamified academic tutor and study companion. Your goal is to make learning fun and deep.
Style: Use the Socratic method (ask guiding questions). Be enthusiastic, use emojis 🌟, and relate concepts to real-world analogies.
Format: Use clear headings, bullet points, and bold text.
Capabilities: (Same as standard mode: Diagrams, Math, Images, Screenshots, Presentations).

Instructions:
- **Gamify Learning**: Award "points" or "badges" (emojis) for correct answers or good questions.
- **Analogies**: Always explain complex topics using simple, relatable real-world analogies.
- **Interactive Quizzes**: After explaining a concept, immediately ask a quick, fun multiple-choice or open-ended question to check understanding.
- **Step-by-Step**: Break down problems into bite-sized steps.
- **Files**: If user provides a file, create a "Study Guide" or "Flashcards" from it.
`;
            }

            // Add Custom Instructions
            const customInstructions = localStorage.getItem('ahamai_custom_instructions');
            if (customInstructions && customInstructions.trim()) {
                systemPrompt += `\n\nUSER CUSTOM INSTRUCTIONS (MUST FOLLOW):\n${customInstructions.trim()}\n`;
            }

            if (searchContext) {
                systemPrompt += searchContext;
            } else {
                if (!isStudyMode) systemPrompt += " Answer the user's question to the best of your ability.";
            }

            // Build message history for context
            const chat = chatManager.getChat(chatManager.currentChatId);
            const historyMessages = chat.messages.map(m => ({
                role: m.role,
                content: m.content
            })).slice(-10); // Last 10 messages

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
            }, abortController.signal);

            finalAnswer = fullResponse;
            uiHandler.setStopMode(false);

            // Show Actions (Copy, Regenerate, Export)
            uiHandler.addMessageActions(actionsDiv, contentDiv, () => {
                // Regenerate logic: Call submit with same query
                handleUserSubmit(query, model, isSearchEnabled, isStudyMode, attachment);
            });

        } catch (error) {
            if (error.name === 'AbortError') {
                 // Handled in onStop
                 return;
            }
            uiHandler.removeLoading(loadingDiv);
            uiHandler.setStopMode(false);
            uiHandler.showError(`An error occurred: ${error.message}`);
            console.error(error);
            finalAnswer = "Error generating response.";
        }

        // Save assistant response if not incognito
        if (!uiHandler.isIncognito) {
            chatManager.addMessageToChat(chatManager.currentChatId, {
                role: 'assistant',
                content: finalAnswer,
                sources: sources
            });
        }
    };

    uiHandler.init(handleUserSubmit, handleHistoryAction, handleSaveSettings);
});
