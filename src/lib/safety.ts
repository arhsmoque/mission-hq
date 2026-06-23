const TEXTUAL_NUMBERS = [
  'zero','one','two','three','four','five','six','seven','eight','nine','ten',
  'eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen','twenty',
  'twenty-one','twenty-two','twenty-three','twenty-four','twenty-five','twenty-six','twenty-seven','twenty-eight','twenty-nine','thirty',
  'thirty-one','thirty-two','thirty-three','thirty-four','thirty-five','forty','forty-five','fifty','sixty','seventy','eighty','ninety','hundred',
  'satu','dua','tiga','empat','lima','enam','tujuh','lapan','sembilan','sepuluh',
  'sebelas','dua belas','tiga belas','empat belas','lima belas','dua puluh','tiga puluh',
].join('|');

// Sentence patterns that look like direct answer delivery
const directAnswerPatterns: RegExp[] = [
  // Explicit answer declarations (English)
  /\bthe answer is\s+[\w.,-]+/i,
  /\bit'?s\s+\d+(?:[.,]\d+)?\b/i,
  /\bequals?\s+\d+(?:[.,]\d+)?\b/i,
  /\bgets?\s+\d+(?:[.,]\d+)?\b/i,
  /\d+\s*(?:is the answer|is correct|is right)/i,
  // Textual number as answer
  new RegExp(`\\bthe answer is\\s+(?:${TEXTUAL_NUMBERS})\\b`, 'i'),
  new RegExp(`\\bit'?s\\s+(?:${TEXTUAL_NUMBERS})\\b`, 'i'),
  new RegExp(`(?:${TEXTUAL_NUMBERS})\\s+(?:is the answer|is correct|is right)`, 'i'),
  // Option letter reveals
  /(?:the correct (?:option|answer) is|choose option|select option|it's option)\s*[A-D]\b/i,
  /\boption\s*[A-D]\s*is\s*(?:correct|right)/i,
  // Malay answer patterns
  /\bjawapannya\s+(?:ialah|adalah)\s+[\w.,-]+/i,
  /\bnombor(?:nya)?\s+(?:ialah|adalah)\s+[\w.,-]+/i,
  new RegExp(`\\bjawapannya\\s+(?:ialah|adalah)\\s+(?:${TEXTUAL_NUMBERS})`, 'i'),
  // Math result phrasing
  /\bthe (?:total|sum|product|result|difference|quotient) is\s+\d+/i,
  /\byou(?:'ll| will) get\s+\d+/i,
  /\bso (?:the answer|it'?s)\s+\d+/i,
];

// Numbers that appear in "context" positions — not answer candidates
// Lookbehind: the number is preceded by one of these reference words (with optional space)
const CONTEXT_WORD_RE = /(?:question|number|no\.?|q\.?|problem|step|part|page|chapter|example|exercise|activity|section|figure|item|soalan|nombor|bahagian|latihan)\s*$/i;

export function sanitizeResponse(response: string, ocrText: string): string {
  // Check direct answer patterns first — fast path
  for (const pattern of directAnswerPatterns) {
    if (pattern.test(response)) {
      return "You're on the right track! Instead of giving you the answer, let's think through it together. What do you notice about the problem?";
    }
  }

  // Extract numbers from OCR text (the source-of-truth values)
  const ocrNumbers = new Set((ocrText.match(/\b\d+(?:\.\d+)?\b/g) ?? []));
  if (ocrNumbers.size === 0) return response;

  // Tokenise the response into sentences so we can check context per sentence
  const sentences = response.split(/(?<=[.!?])\s+/);
  for (const sentence of sentences) {
    // Skip sentences that are clearly questions — Socratic guidance asking a question is safe
    if (sentence.trimEnd().endsWith('?')) continue;

    const numbers = [...sentence.matchAll(/\b(\d+(?:\.\d+)?)\b/g)];
    for (const match of numbers) {
      const num = match[1];
      if (!ocrNumbers.has(num)) continue;

      // Check if this number follows a context reference word in the sentence
      const before = sentence.slice(0, match.index);
      if (CONTEXT_WORD_RE.test(before)) continue;

      // Number appears in a non-question sentence without a context prefix — likely an answer leak
      return "That's a great question! What strategy could you use to find out? Try breaking it into smaller parts or drawing a diagram.";
    }
  }

  return response;
}
