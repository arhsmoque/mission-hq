/**
 * AI provider port — the contract every AI adapter must satisfy.
 *
 * To add a new provider:
 *   1. Create src/adapters/ai/<provider>-adapter.ts implementing AIPort
 *   2. Point `aiAdapter` in src/adapters/index.ts to it
 *   3. Done — the rest of the app is unaware of the change
 *
 * Generate a stub with:  node scripts/adapter.mjs new-ai-stub --name=<provider>
 */

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OcrResult {
  text: string;
  confidence: number;
  engine: 'vision_llm' | 'tesseract';
}

export interface AIPort {
  chat(
    messages: AIChatMessage[],
    model: string,
    temperature?: number
  ): Promise<string>;

  /** Extract text from an image using a vision model. */
  ocrImage(imageBase64: string, mimeType: string): Promise<OcrResult>;
}
