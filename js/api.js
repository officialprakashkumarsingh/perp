class APIHandler {
    constructor() {
        this.cerebrasKeys = [...CONFIG.CEREBRAS_API_KEYS];
        this.braveKeys = [...CONFIG.BRAVE_API_KEYS];
        this.currentCerebrasKeyIndex = 0;
        this.currentBraveKeyIndex = 0;
    }

    getCerebrasKey() {
        return this.cerebrasKeys[this.currentCerebrasKeyIndex];
    }

    getBraveKey() {
        return this.braveKeys[this.currentBraveKeyIndex];
    }

    rotateCerebrasKey() {
        this.currentCerebrasKeyIndex = (this.currentCerebrasKeyIndex + 1) % this.cerebrasKeys.length;
        console.log(`Rotated Cerebras Key to index ${this.currentCerebrasKeyIndex}`);
    }

    rotateBraveKey() {
        this.currentBraveKeyIndex = (this.currentBraveKeyIndex + 1) % this.braveKeys.length;
        console.log(`Rotated Brave Key to index ${this.currentBraveKeyIndex}`);
    }

    async searchWikipedia(query, deep = false) {
        try {
            // Step 1: Search for pages
            const endpoint = `https://en.wikipedia.org/w/api.php?action=query&list=search&prop=info&inprop=url&utf8=&format=json&origin=*&srlimit=${deep ? 1 : 3}&srsearch=${encodeURIComponent(query)}`;
            const response = await fetch(endpoint);
            if (!response.ok) throw new Error('Wiki Error');
            const data = await response.json();
            if (!data.query || !data.query.search || data.query.search.length === 0) return [];

            const results = data.query.search.map(result => ({
                title: result.title,
                pageid: result.pageid,
                description: result.snippet.replace(/<[^>]*>/g, ''), // Strip HTML
                url: `https://en.wikipedia.org/?curid=${result.pageid}`,
                source: 'Wikipedia'
            }));

            // Step 2: If deep search, fetch full content for the top result
            if (deep && results.length > 0) {
                const pageId = results[0].pageid;
                const contentEndpoint = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&pageids=${pageId}&explaintext=1&format=json&origin=*`;
                const contentResponse = await fetch(contentEndpoint);
                const contentData = await contentResponse.json();
                if (contentData.query && contentData.query.pages && contentData.query.pages[pageId]) {
                    const extract = contentData.query.pages[pageId].extract;
                    results[0].fullContent = extract; // Attach full content
                }
            }

            return results;
        } catch (e) {
            console.error("Wikipedia Search Error:", e);
            return [];
        }
    }

    async searchWeb(query) {
        let attempts = 0;
        const maxAttempts = this.braveKeys.length;

        while (attempts < maxAttempts) {
            const apiKey = this.getBraveKey();
            try {
                const response = await fetch(`${CONFIG.BRAVE_SEARCH_URL}?q=${encodeURIComponent(query)}&count=10`, {
                    headers: {
                        'Accept': 'application/json',
                        'X-Subscription-Token': apiKey
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    return data.web.results;
                } else {
                    console.error(`Brave API error: ${response.status}`);
                    this.rotateBraveKey();
                }
            } catch (error) {
                console.error('Brave Search Network Error:', error);
                this.rotateBraveKey();
            }
            attempts++;
        }
        // Fallback or just return empty if all fail
        console.error('All Brave Search API keys failed.');
        return [];
    }

    async chatCompletion(messages, model, onChunk, signal) {
        let attempts = 0;
        const maxAttempts = this.cerebrasKeys.length;

        while (attempts < maxAttempts) {
            if (signal && signal.aborted) {
                throw new DOMException("Aborted", "AbortError");
            }

            const apiKey = this.getCerebrasKey();
            try {
                const response = await fetch(CONFIG.CEREBRAS_API_URL, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`
                    },
                    body: JSON.stringify({
                        model: model,
                        messages: messages,
                        stream: true
                    }),
                    signal: signal
                });

                if (response.ok) {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder("utf-8");
                    let buffer = "";

                    try {
                        while (true) {
                            const { done, value } = await reader.read();
                            if (done) break;
                            const chunk = decoder.decode(value, { stream: true });
                            buffer += chunk;

                            const lines = buffer.split("\n");
                            buffer = lines.pop(); // Keep the last partial line in the buffer

                            for (const line of lines) {
                                if (line.trim() === "") continue;
                                if (line.trim() === "data: [DONE]") return;
                                if (line.startsWith("data: ")) {
                                    try {
                                        const json = JSON.parse(line.substring(6));
                                        const content = json.choices[0].delta.content;
                                        if (content) {
                                            onChunk(content);
                                        }
                                    } catch (e) {
                                        console.error("Error parsing stream line", e);
                                    }
                                }
                            }
                        }
                    } catch (readError) {
                        if (readError.name === 'AbortError') {
                            throw readError;
                        }
                        // Other read errors might be recoverable by rotation logic or just logged
                        console.error("Stream read error", readError);
                        throw readError; // Re-throw to trigger rotation logic if valid? Actually stream cut mid-way usually means we should stop or retry.
                        // If it's network error, we retry.
                    }
                    return; // Success
                } else {
                    console.error(`Cerebras API error: ${response.status}`);
                    this.rotateCerebrasKey();
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    throw error;
                }
                console.error('Cerebras API Network Error:', error);
                this.rotateCerebrasKey();
            }
            attempts++;
        }
        throw new Error('All Cerebras API keys failed.');
    }

    async fetchPageContent(url) {
        // Use a CORS proxy to fetch text content
        try {
            // Using allorigins.win as a free proxy
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error("Proxy error");
            const data = await response.json();

            // Basic text extraction from HTML using a DOMParser
            const parser = new DOMParser();
            const doc = parser.parseFromString(data.contents, "text/html");

            // Remove scripts and styles
            doc.querySelectorAll('script, style, noscript, svg, img, iframe').forEach(el => el.remove());

            // Get text content and clean up whitespace
            let text = doc.body.textContent || "";
            text = text.replace(/\s+/g, ' ').trim().substring(0, 10000); // Limit context

            return text;
        } catch (e) {
            console.error("Failed to fetch page content:", e);
            return null;
        }
    }

}
