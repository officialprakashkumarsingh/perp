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

    // Queue System
    const requestQueue = [];
    let isGenerating = false;

    const processQueue = async () => {
        if (isGenerating || requestQueue.length === 0) return;

        const nextRequest = requestQueue.shift();
        uiHandler.updateQueuePanel(requestQueue); // Update UI
        await handleUserSubmit(nextRequest.query, nextRequest.model, nextRequest.isSearchEnabled, nextRequest.isStudyMode, nextRequest.attachment);

        // Process next after delay to ensure cleanup
        setTimeout(processQueue, 500);
    };

    const handleUserSubmit = async (query, model, isSearchEnabled, isStudyMode, attachment) => {
        // Check if busy
        if (isGenerating) {
            requestQueue.push({ query, model, isSearchEnabled, isStudyMode, attachment });
            uiHandler.updateQueuePanel(requestQueue);
            return;
        }

        isGenerating = true;
        const isWikiEnabled = document.getElementById('wiki-switch') ? document.getElementById('wiki-switch').checked : false;

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
                isGenerating = false; // Reset flag
                // Finalize what we have
                chatManager.addMessageToChat(chatManager.currentChatId, {
                    role: 'assistant',
                    content: finalAnswer + "\n[Stopped by user]",
                    sources: sources
                });
                processQueue(); // Check for next
            }
        };

        try {
            // 1. Search Web / Wiki
            let searchContext = "";
            let sources = [];

            // Broad Search Logic: Combine Wiki and Web (Brave) + News
            if ((isWikiEnabled || isSearchEnabled) && query.trim().length > 0) {
                const searchPromises = [];

                // Wikipedia (if explicitly enabled OR broad web search)
                // User asked for "data from wikipedia" in web search
                searchPromises.push(apiHandler.searchWikipedia(query, true).catch(e => {
                    console.error("Wiki search failed", e);
                    return [];
                }));

                // Web Search & News (if enabled)
                if (isSearchEnabled) {
                    // Standard Search
                    searchPromises.push(apiHandler.searchWeb(query).catch(e => {
                         console.error("Brave search failed", e);
                         return [];
                    }));

                    // News / Broad Search (India + World context)
                    // We append "latest news" to try and catch RSS/News results
                    const newsQuery = query + " latest news India world";
                    searchPromises.push(apiHandler.searchWeb(newsQuery).catch(e => {
                         console.error("Brave news search failed", e);
                         return [];
                    }));
                }

                try {
                    const resultsArray = await Promise.all(searchPromises);
                    const allSources = resultsArray.flat();

                    // Deduplicate by URL
                    const seenUrls = new Set();
                    sources = [];
                    for (const s of allSources) {
                        if (!s.url || seenUrls.has(s.url)) continue;
                        seenUrls.add(s.url);
                        sources.push(s);
                    }

                    uiHandler.renderSources(sourcesDiv, sources);

                    if (sources.length > 0) {
                         searchContext = `\n\n--- SEARCH RESULTS (Wiki, Web, News) ---\n`;
                         sources.forEach((result, index) => {
                             const content = result.fullContent || result.description || "No description available.";
                             searchContext += `Source [${index + 1}] (${result.source || 'Web'}): ${result.title}\nURL: ${result.url}\nContent: ${content}\n\n`;
                         });
                         searchContext += `--- END SEARCH RESULTS ---\n\nUse this detailed information to provide a comprehensive and latest answer. Cite sources as [number].`;
                    } else if (isSearchEnabled) {
                        searchContext = "\n(Search performed but no results found. Please answer based on internal knowledge)";
                    }

                } catch (e) {
                    console.error("Error processing search results", e);
                    searchContext = "\n(Search error, please answer based on internal knowledge)";
                }
            }

            // 2. Prepare Context with Date/Time and Capabilities
            const currentDate = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'medium' });
            let systemPrompt = `Current Date and Time: ${currentDate}. You are AhamAI, a helpful AI assistant.
IMPORTANT: You must always provide the latest information available, especially for current events. Use the provided search results to verify the current status of events.

Capabilities:
1. **Diagrams**: You can generate diagrams, flowcharts, graphs, and visualizations using Mermaid.js. When a user asks for a diagram, output a code block with the language set to \`mermaid\`.
   Example:
   \`\`\`mermaid
   graph TD;
     A-->B;
   \`\`\`
2. **Math & Science**: You can render mathematical and chemical formulas using LaTeX. Use standard LaTeX delimiters: $ for inline math and $$ for display math.
   Example: The area is $A = \pi r^2$.

3. **Attachments & YouTube**: The user may provide text from attached files (PDF, code, text, zip). You also have the capability to automatically read and summarize **YouTube videos** if the user provides a URL. Use this context to answer questions.

4. **Image Generation**: You can generate images using Pollinations AI.
   To generate an image, you MUST use this exact Markdown format:
   \`![Image Description](https://image.pollinations.ai/prompt/{description}?width=768&height=1024&seed={random}&nologo=true)\`
   Replace \`{description}\` with a URL-encoded detailed prompt for the image.
   Replace \`{random}\` with a random integer seed (e.g. 12345).
   Example: \`![A futuristic city](https://image.pollinations.ai/prompt/futuristic%20city%20sunset?width=768&height=1024&seed=54321&nologo=true)\`
   Do NOT use any other API or format. Generate images when the user explicitly asks or when it adds significant value.

5. **Presentations**: You can generate stylish, themed presentations.
   To do this, output a single HTML block containing multiple \`<div class="slide">\` elements.
   Each slide should have inline CSS for styling (backgrounds, fonts, colors) based on the topic.
   Do not use \`<html>\` or \`<body>\` tags, just the divs.
   Example:
   \`\`\`html
   <div class="slide" style="background-color: #1e3c72; color:white;">
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

7. **Quizzes**: You can generate interactive quizzes.
   Output the quiz strictly as a JSON object wrapped in \`[QUIZ_JSON]\` tags.
   Format:
   \`[QUIZ_JSON]
   {
     "questions": [
       { "question": "Question text?", "options": ["A", "B", "C", "D"], "answerIndex": 0 },
       ...
     ]
   }
   [/QUIZ_JSON]\`

8. **Flashcards**: You can generate flashcards.
   Output the cards strictly as a JSON object wrapped in \`[FLASHCARDS_JSON]\` tags.
   Format:
   \`[FLASHCARDS_JSON]
   {
     "cards": [
       { "front": "Term", "back": "Definition" },
       ...
     ]
   }
   [/FLASHCARDS_JSON]\`

9. **Documents / PDF Generation**: You can generate documents that the user can download as PDF.
   When the user asks for a "PDF", "Document", "Report", or to "generate a PDF file", output the content wrapped in a single \`<div class="document-a4">\` container.
   Inside this container, use standard HTML tags (h1, h2, p, ul, table).
   You can apply inline CSS to style the document exactly as the user requested (colors, fonts, sizes, layout).
   Example:
   \`\`\`html
   <div class="document-a4" style="font-family: 'Times New Roman'; padding: 2rem; color: #333;">
     <h1 style="color: navy; text-align: center;">Project Report</h1>
     <p>Content goes here...</p>
   </div>
   \`\`\`

10. **Charts**: You can generate interactive charts (Bar, Line, Pie, Doughnut, Radar) using Chart.js.
    To generate a chart, output a JSON object wrapped in \`[CHART_JSON]\` tags.
    Format:
    \`[CHART_JSON]
    {
      "type": "bar",
      "data": {
        "labels": ["A", "B", "C"],
        "datasets": [{ "label": "Label", "data": [10, 20, 30], "backgroundColor": ["#FF6384", "#36A2EB", "#FFCE56"] }]
      },
      "options": { ... }
    }
    [/CHART_JSON]\`
    Always ensure the JSON is valid. Use bright colors.

11. **Notebook Notes**: You can generate "notebook style" notes which look like handwritten notes on lined paper.
    Use this when the user asks for "notes", "study notes", or "notebook style".
    Wrap the content in a \`<div class="notebook-style">\` container.
    Use headings, bullet points, and highlighting (\`<mark>\` tag) to make it effective.
    Example:
    \`\`\`html
    <div class="notebook-style">
      <h2>Title</h2>
      <p>Important concept...</p>
      <ul><li>Point 1</li></ul>
    </div>
    \`\`\`

Instructions:
- If the user asks to "draw" or "visualize" a system, process, or chart, check if a generic Mermaid diagram or a quantitative Chart.js chart is better. For quantitative data, use \`[CHART_JSON]\`. For flows, use Mermaid.
- If the user asks for a "presentation" or "slides", generate the HTML slide format described above.
- If the user asks for a "quiz", generate the JSON quiz format.
- If the user asks for "flashcards", generate the JSON flashcards format.
- If the user asks for a "PDF" or "Document", generate the HTML Document format.
- If the user asks for "notes" or "notebook", generate the HTML Notebook format.
- If you learn something new and specific about the user (e.g., name, profession, preferences), output a memory tag at the end of your response like this: \`[MEMORY: User is a software engineer]\`.
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

            // Add Settings (Language, Tone, Custom Instructions)
            const customInstructions = localStorage.getItem('ahamai_custom_instructions');
            const userTone = localStorage.getItem('ahamai_tone') || 'neutral';
            const userLang = localStorage.getItem('ahamai_language') || 'en';

            // Load Memories
            const memories = JSON.parse(localStorage.getItem('ahamai_memories') || '[]');
            let memoryContext = "";
            if (memories.length > 0) {
                memoryContext = "\n\nMEMORIES ABOUT USER:\n" + memories.map(m => `- ${m}`).join('\n');
            }

            let toneInstruction = "";
            if (userTone === 'professional') toneInstruction = "Use a formal, professional, and objective tone.";
            else if (userTone === 'friendly') toneInstruction = "Use a warm, conversational, and friendly tone.";
            else if (userTone === 'humorous') toneInstruction = "Be witty, include subtle humor, and keep it lighthearted.";

            let langInstruction = "";
            if (userLang !== 'en') {
                 // Simple mapping, can be expanded
                 const langs = {'es': 'Spanish', 'fr': 'French', 'hi': 'Hindi'};
                 if (langs[userLang]) langInstruction = `Answer strictly in ${langs[userLang]}.`;
            }

            if (customInstructions && customInstructions.trim()) {
                systemPrompt += `\n\nUSER CUSTOM INSTRUCTIONS (MUST FOLLOW):\n${customInstructions.trim()}\n`;
            }
            if (memoryContext) {
                systemPrompt += memoryContext;
            }
            if (toneInstruction) systemPrompt += `\nTONE: ${toneInstruction}`;
            if (langInstruction) systemPrompt += `\nLANGUAGE: ${langInstruction}`;

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

            // Process Memories in response
            const memoryRegex = /\[MEMORY: (.*?)\]/g;
            let match;
            while ((match = memoryRegex.exec(fullResponse)) !== null) {
                const newMemory = match[1];
                const currentMemories = JSON.parse(localStorage.getItem('ahamai_memories') || '[]');
                if (!currentMemories.includes(newMemory)) {
                    currentMemories.push(newMemory);
                    localStorage.setItem('ahamai_memories', JSON.stringify(currentMemories));
                }
            }

            // Clean response for display (remove memory tags)
            finalAnswer = fullResponse.replace(memoryRegex, '').trim();
            uiHandler.updateBotMessage(contentDiv, finalAnswer); // Update final clean message

            uiHandler.setStopMode(false);

            // Show Actions (Copy, Regenerate, Export)
            uiHandler.addMessageActions(actionsDiv, contentDiv, (modifier) => {
                // Regenerate logic: Call submit with same query
                let newQuery = query;
                if (typeof modifier === 'string') {
                    newQuery = `${query}\n\n[Instruction: Re-write the above response with the following style/modification: ${modifier}]`;
                }
                handleUserSubmit(newQuery, model, isSearchEnabled, isStudyMode, attachment);
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

        isGenerating = false;
        processQueue();
    };

    // Use a wrapper to intercept initial submit vs queue calls?
    // handleUserSubmit now handles the queue check internally if called directly.
    // However, uiHandler calls it.

    uiHandler.init(handleUserSubmit, handleHistoryAction, handleSaveSettings);

    // URL Parameter Handling (OpenSearch/Query)
    const urlParams = new URLSearchParams(window.location.search);
    const queryParam = urlParams.get('q');
    if (queryParam) {
        // Remove query param from URL without reload
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);

        // Trigger submit
        handleUserSubmit(queryParam, CONFIG.MODELS[0], true, false, null);
    }
});
