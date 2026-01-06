// Initialize PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
}

const extractTextFromFile = async (file) => {
    if (!file) return "";
    const type = file.type;
    const name = file.name.toLowerCase();

    try {
        if (type === 'application/pdf' || name.endsWith('.pdf')) {
            return await extractTextFromPDF(file);
        } else if (
            type.startsWith('text/') ||
            name.endsWith('.txt') ||
            name.endsWith('.js') ||
            name.endsWith('.py') ||
            name.endsWith('.html') ||
            name.endsWith('.css') ||
            name.endsWith('.json') ||
            name.endsWith('.md')
        ) {
            return await file.text();
        } else if (
            type === 'application/zip' ||
            type === 'application/x-zip-compressed' ||
            name.endsWith('.zip')
        ) {
            return await extractTextFromZip(file);
        } else {
            // Try reading as text anyway for other code files
            return await file.text();
        }
    } catch (e) {
        console.error("File extraction error:", e);
        return `[Error extracting file ${file.name}: ${e.message}]`;
    }
};

const extractTextFromPDF = async (file) => {
    if (typeof pdfjsLib === 'undefined') throw new Error("PDF.js not loaded.");
    const arrayBuffer = await file.arrayBuffer();
    const typedArray = new Uint8Array(arrayBuffer);
    const loadingTask = pdfjsLib.getDocument({ data: typedArray });
    const pdf = await loadingTask.promise;
    let fullText = "";
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map(item => item.str).join(' ');
        fullText += `[Page ${i}]\n${pageText}\n\n`;
    }
    return fullText;
};

const extractTextFromZip = async (file) => {
    if (typeof JSZip === 'undefined') throw new Error("JSZip not loaded.");
    const zip = new JSZip();
    const zipContent = await zip.loadAsync(file);
    let fullText = "";

    // Iterate over files
    const promises = [];
    zipContent.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir) {
            // Check if likely text
            const lowerName = zipEntry.name.toLowerCase();
            if (lowerName.match(/\.(txt|md|js|py|html|css|json|java|cpp|c|h|cs|rb|php|xml|yaml|yml|sh)$/)) {
                promises.push(
                    zipEntry.async("string").then(content => {
                        return `--- File: ${zipEntry.name} ---\n${content}\n\n`;
                    })
                );
            }
        }
    });

    const results = await Promise.all(promises);
    return results.join("");
};

window.extractTextFromFile = extractTextFromFile;
// Backwards compatibility if needed, though we will update usage
window.extractTextFromPDF = extractTextFromPDF;
