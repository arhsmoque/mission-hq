export function sanitizeResponse(response: string, ocrText: string): string {
  const ocrNumbers = new Set((ocrText.match(/\b\d+(?:\.\d+)?\b/g) || []));
  const responseNumbers = response.match(/\b\d+(?:\.\d+)?\b/g) || [];

  for (const num of responseNumbers) {
    if (ocrNumbers.has(num)) {
      return "That's a great question! What strategy could you use to find out? Try breaking it into smaller parts or drawing a diagram.";
    }
  }

  const directAnswerPatterns = [
    /The answer is\s*\d+/i,
    /It'?s\s*\d+/i,
    /\d+\s*(is the answer|is correct)/i,
  ];

  for (const pattern of directAnswerPatterns) {
    if (pattern.test(response)) {
      return "You're on the right track! Instead of giving you the answer, let's think through it together. What do you notice about the problem?";
    }
  }

  return response;
}
