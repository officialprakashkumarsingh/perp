document.addEventListener('DOMContentLoaded', () => {
    const apiHandler = new APIHandler();
    const uiHandler = new UIHandler();

    const handleUserSubmit = async (query, model) => {
        uiHandler.appendUserMessage(query);
        const { messageDiv, sourcesDiv, contentDiv } = uiHandler.createBotMessageContainer();
        const loadingDiv = uiHandler.showLoading(contentDiv);

        try {
            // 1. Search Web
            let searchResults = [];
            try {
                searchResults = await apiHandler.searchWeb(query);
                uiHandler.renderSources(sourcesDiv, searchResults);
            } catch (searchError) {
                console.error("Search failed, continuing without sources", searchError);
            }

            // 2. Prepare Context
            let context = "You are AhamAI, a helpful AI assistant. Answer the user's question.";
            if (searchResults && searchResults.length > 0) {
                context += "\n\nUse the following search results to answer the user's question:\n";
                searchResults.forEach((result, index) => {
                    context += `[${index + 1}] ${result.title}: ${result.description}\nURL: ${result.url}\n\n`;
                });
                context += "Cite the sources using [number] notation where appropriate.";
            }

            const messages = [
                { role: "system", content: context },
                { role: "user", content: query }
            ];

            // 3. Call LLM
            uiHandler.removeLoading(loadingDiv);
            await apiHandler.chatCompletion(messages, model, (chunk) => {
                uiHandler.updateBotMessage(contentDiv, chunk);
            });

        } catch (error) {
            uiHandler.removeLoading(loadingDiv);
            uiHandler.showError(`An error occurred: ${error.message}`);
            console.error(error);
        }
    };

    uiHandler.init(handleUserSubmit);
});
