export function sanitizeResponse(response: string, ocrText: string): string {
  // Extract response numbers but ignore numbers that are preceded by question/number labels
  const safeNumRegex = /(?<!\b(?:question|number|no\.?|q\.?|problem|step|part)\s*)\b\d+(?:\.\d+)?\b/gi;
  const responseNumbers = response.match(safeNumRegex) || [];
  const ocrNumbers = new Set((ocrText.match(/\b\d+(?:\.\d+)?\b/g) || []));

  for (const num of responseNumbers) {
    if (ocrNumbers.has(num)) {
      return "That's a great question! What strategy could you use to find out? Try breaking it into smaller parts or drawing a diagram.";
    }
  }

  const directAnswerPatterns = [
    /The answer is\s*\d+/i,
    /It'?s\s*\d+/i,
    /\d+\s*(is the answer|is correct)/i,
    // Textual number checks
    /the answer is\s*(?:one|two|three|four|five|six|seven|eight|nine|ten)/i,
    /it'?s\s*(?:one|two|three|four|five|six|seven|eight|nine|ten)/i,
    /(?:one|two|three|four|five|six|seven|eight|nine|ten)\s*(is the answer|is correct)/i,
    // Option letter checks
    /(?:the correct option is|the answer is option|choose option|select option|it's option)\s*[A-D]\b/i,
    /\boption\s*[A-D]\s*is\s*correct/i,
  ];

  for (const pattern of directAnswerPatterns) {
    if (pattern.test(response)) {
      return "You're on the right track! Instead of giving you the answer, let's think through it together. What do you notice about the problem?";
    }
  }

  return response;
}
