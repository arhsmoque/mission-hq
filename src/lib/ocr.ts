/**
 * ocr.ts — unified OCR entry point
 *
 * Strategy:
 *   1. DOCX: extract text via mammoth (client-side, no vision needed).
 *   2. Primary: send image/PDF to a vision LLM via OpenRouter (Gemini 2.0 Flash).
 *   3. Fallback: run Tesseract.js in-browser if the LLM call fails.
 */

import { aiAdapter } from '@/adapters';
import { runOcr as runTesseract } from '@/lib/tesseract';
import type { OcrResult } from '@/ports/ai-port';

export type { OcrResult };

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function isDocx(file: File): boolean {
  return file.type === DOCX_MIME || file.name.toLowerCase().endsWith('.docx');
}

export async function runOcr(file: File): Promise<OcrResult> {
  if (isDocx(file)) {
    const mammoth = await import('mammoth');
    const buffer = await file.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buffer });
    return { text: result.value.trim(), confidence: 100, engine: 'vision_llm' };
  }

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
