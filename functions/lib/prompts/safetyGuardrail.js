"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sanitizeResponse = sanitizeResponse;
function sanitizeResponse(response, ocrText) {
    // Extract numbers from OCR text (potential answers)
    const ocrNumbers = new Set((ocrText.match(/\b\d+(?:\.\d+)?\b/g) || []));
    // Extract numbers from response
    const responseNumbers = response.match(/\b\d+(?:\.\d+)?\b/g) || [];
    // Check if response contains a number that appears in OCR and looks like a direct answer
    for (const num of responseNumbers) {
        if (ocrNumbers.has(num)) {
            // Simple heuristic: if the response is short and contains the number, it's likely a direct answer
            if (response.length < 150) {
                return "That's a great question! What strategy could you use to find out? Try breaking it into smaller parts or drawing a diagram.";
            }
        }
    }
    // Check for direct answer patterns
    const directAnswerPatterns = [
        /^\s*The answer is\s*\d+/i,
        /^\s*It'?s\s*\d+/i,
        /^\s*\d+\s*(is the answer|is correct)/i,
    ];
    for (const pattern of directAnswerPatterns) {
        if (pattern.test(response)) {
            return "You're on the right track! Instead of giving you the answer, let's think through it together. What do you notice about the problem?";
        }
    }
    return response;
}
//# sourceMappingURL=safetyGuardrail.js.map