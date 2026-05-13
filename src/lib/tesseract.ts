import { createWorker } from 'tesseract.js';

export interface OcrResult {
  text: string;
  confidence: number;
}

export async function runOcr(imageSource: File | string): Promise<OcrResult> {
  const worker = await createWorker('eng+msa+chi_sim');

  try {
    const {
      data: { text, confidence },
    } = await worker.recognize(imageSource);

    return {
      text: text.trim(),
      confidence,
    };
  } finally {
    await worker.terminate();
  }
}
