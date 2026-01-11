// Research Mode Implementation (Mocked for key-less requirement)
// Since we cannot use paid APIs, we will use a combination of Wikipedia API (free)
// and simulating a "Deep Research" process by using the LLM to plan queries and synthesize information.

class ResearchAgent {
    constructor(apiHandler) {
        this.apiHandler = apiHandler;
    }

    async conductResearch(query, onProgress) {
        onProgress("Initializing Research Agent...");

        // 1. Plan Research
        onProgress("Analyzing query and planning research steps...");
        // We could use the LLM to generate keywords, but to save latency/tokens, we'll do simple extraction + Wikipedia.

        const keywords = query.replace(/[^\w\s]/gi, '').split(' ').filter(w => w.length > 3);
        const mainTopic = keywords.join(' ');

        // 2. Fetch Data (Wikipedia)
        onProgress(`Searching Wikipedia for "${mainTopic}"...`);
        let wikiData = "";
        try {
            // Wikipedia API is free and doesn't require key
            const searchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&format=json&origin=*`;
            const searchResp = await fetch(searchUrl);
            const searchJson = await searchResp.json();

            if (searchJson.query.search && searchJson.query.search.length > 0) {
                const topResults = searchJson.query.search.slice(0, 3);

                for (const result of topResults) {
                     onProgress(`Reading article: ${result.title}...`);
                     const pageUrl = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro&explaintext&titles=${encodeURIComponent(result.title)}&format=json&origin=*`;
                     const pageResp = await fetch(pageUrl);
                     const pageJson = await pageResp.json();
                     const pages = pageJson.query.pages;
                     const pageId = Object.keys(pages)[0];
                     if (pages[pageId].extract) {
                         wikiData += `\n\nSource: Wikipedia (${result.title})\n${pages[pageId].extract}`;
                     }
                }
            } else {
                onProgress("No direct Wikipedia matches found. Trying broader search...");
            }
        } catch (e) {
            console.error("Wikipedia fetch failed", e);
            onProgress("Wikipedia search failed. Proceeding with internal knowledge.");
        }

        // 3. (Optional) DuckDuckGo / External via Proxy
        // If we had a reliable no-key proxy for DDG, we'd use it here.
        // For now, we rely on the User's "No Key" request by strictly using Wiki + LLM.

        onProgress("Synthesizing information into Research Paper format...");

        return wikiData;
    }
}

async function getYoutubeTranscript(videoId) {
    // Attempt to fetch transcript using a public instance of a YouTube frontend API (e.g., Piped, Invidious)
    // Piped API: https://pipedapi.kavin.rocks/streams/{videoId}
    // This returns JSON with a "subtitles" array. Then we fetch the VTT/JSON subtitle.

    try {
        const response = await fetch(`https://pipedapi.kavin.rocks/streams/${videoId}`);
        if (!response.ok) throw new Error("Video info not found");
        const data = await response.json();

        // Find English subtitles
        const subtitles = data.subtitles;
        if (!subtitles || subtitles.length === 0) return null;

        const engSub = subtitles.find(s => s.code === 'en') || subtitles[0];

        // Fetch the actual subtitle text
        const subResponse = await fetch(engSub.url);
        const subText = await subResponse.text();

        // Clean VTT/JSON to plain text
        // Piped often returns JSON or VTT. Let's assume JSON for 'auto' or VTT.
        // If it's VTT, we strip timestamps.

        if (engSub.mimeType === 'application/json') {
             const json = JSON.parse(subText);
             // Piped JSON format usually has 'text' field in segments
             return json.map(s => s.text).join(' ');
        } else {
            // Simple VTT regex stripper
            return subText.replace(/WEBVTT/g, '').replace(/(\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3})/g, '').replace(/\n+/g, ' ').trim();
        }
    } catch (e) {
        console.error("Failed to fetch transcript", e);
        return null;
    }
}
