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

    async searchWeb(query) {
        let attempts = 0;
        const maxAttempts = this.braveKeys.length;

        while (attempts < maxAttempts) {
            const apiKey = this.getBraveKey();
            try {
                const response = await fetch(`${CONFIG.BRAVE_SEARCH_URL}?q=${encodeURIComponent(query)}&count=20`, {
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
        throw new Error('All Brave Search API keys failed.');
    }

    async chatCompletion(messages, model, onChunk) {
        let attempts = 0;
        const maxAttempts = this.cerebrasKeys.length;

        while (attempts < maxAttempts) {
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
                    })
                });

                if (response.ok) {
                    const reader = response.body.getReader();
                    const decoder = new TextDecoder("utf-8");
                    let buffer = "";

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
                    return; // Success
                } else {
                    console.error(`Cerebras API error: ${response.status}`);
                    this.rotateCerebrasKey();
                }
            } catch (error) {
                console.error('Cerebras API Network Error:', error);
                this.rotateCerebrasKey();
            }
            attempts++;
        }
        throw new Error('All Cerebras API keys failed.');
    }
}
