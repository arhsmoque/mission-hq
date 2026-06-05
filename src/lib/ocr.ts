/**
 * ocr.ts — unified OCR entry point
 *
 * Strategy:
 *   1. Primary: send image to a vision LLM via OpenRouter (Gemini 2.0 Flash).
 *      Much more accurate than Tesseract for mixed-language worksheets,
 *      handwriting, skewed photos, and complex layouts.
 *   2. Fallback: run Tesseract.js in-browser if the LLM call fails
 *      (e.g. network offline, quota exhausted).
 */

import { aiAdapter } from '@/adapters';
import { runOcr as runTesseract } from '@/lib/tesseract';
import type { OcrResult } from '@/ports/ai-port';

export type { OcrResult };

export async function runOcr(file: File): Promise<OcrResult> {
  try {
    const base64 = await toBase64(file);
    return await aiAdapter.ocrImage(base64, file.type || 'image/jpeg');
  } catch (err) {
    console.warn('[OCR] Vision LLM failed — falling back to Tesseract:', err);
    const t = await runTesseract(file);
    return { text: t.text, confidence: t.confidence, engine: 'tesseract' };
  }
}

function toBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
