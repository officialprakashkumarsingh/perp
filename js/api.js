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

    async fetchWikipedia(query) {
        try {
            const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error('Wikipedia API error');
            const data = await response.json();
            return `\n\n--- Wikipedia Summary (${data.title}) ---\n${data.extract}\nURL: ${data.content_urls.desktop.page}\n`;
        } catch (e) {
            console.error("Wikipedia fetch error", e);
            return "";
        }
    }

    async fetchDuckDuckGo(query) {
        try {
            // DuckDuckGo Instant Answer API
            const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
            const response = await fetch(proxyUrl);
            if (!response.ok) throw new Error('DDG API error');
            const data = await response.json();
            const json = JSON.parse(data.contents);

            if (json.AbstractText) {
                return `\n\n--- DuckDuckGo Instant Answer ---\n${json.AbstractText}\nSource: ${json.AbstractURL}\n`;
            }
            return "";
        } catch (e) {
            console.error("DuckDuckGo fetch error", e);
            return "";
        }
    }

    async fetchWeather(query) {
        try {
            // 1. Geocoding
            const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`;
            const geoResponse = await fetch(geoUrl);
            const geoData = await geoResponse.json();

            if (!geoData.results || geoData.results.length === 0) return "";

            const { latitude, longitude, name, country } = geoData.results[0];

            // 2. Weather
            const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,weather_code,wind_speed_10m&daily=temperature_2m_max,temperature_2m_min&timezone=auto`;
            const weatherResponse = await fetch(weatherUrl);
            const weatherData = await weatherResponse.json();

            const current = weatherData.current;
            return `\n\n--- Weather for ${name}, ${country} ---\nTemp: ${current.temperature_2m}${weatherData.current_units.temperature_2m}\nWind: ${current.wind_speed_10m}${weatherData.current_units.wind_speed_10m}\n`;
        } catch (e) {
            console.error("Weather fetch error", e);
            return "";
        }
    }

    async fetchHackerNews(query) {
        try {
            const url = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=5`;
            const response = await fetch(url);
            const data = await response.json();

            if (data.hits.length === 0) return "";

            let result = `\n\n--- Hacker News Results for "${query}" ---\n`;
            data.hits.forEach(hit => {
                result += `- ${hit.title} (Points: ${hit.points})\n  URL: ${hit.url}\n`;
            });
            return result + "\n";
        } catch (e) {
            console.error("HN fetch error", e);
            return "";
        }
    }
}
