// Initialize PDF.js worker
// Ensure we point to the correct worker location
if (typeof pdfjsLib !== 'undefined') {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'js/pdf.worker.min.js';
}

const extractTextFromPDF = async (file) => {
    if (!file) return "";

    // Ensure pdfjsLib is available
    if (typeof pdfjsLib === 'undefined') {
        throw new Error("PDF.js library is not loaded.");
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        // Use typed array for better compatibility
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
    } catch (error) {
        console.error("Error extracting PDF text:", error);
        throw new Error("Failed to extract text from PDF.");
    }
};

window.extractTextFromPDF = extractTextFromPDF;
