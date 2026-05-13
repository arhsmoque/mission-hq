import { html as pinyinHtml } from 'pinyin-pro';
import { callOpenRouter } from './ai';
import { buildChinesePrompt } from './prompts';

export interface ChineseAnnotation {
  original: string;
  pinyinHtml: string;
  malay: string;
  english: string;
}

export function addPinyinClient(text: string): string {
  try {
    return pinyinHtml(text, { toneType: 'symbol' });
  } catch {
    return text;
  }
}

export async function annotateChinese(
  text: string,
  model: string
): Promise<ChineseAnnotation> {
  // Client-side pinyin first
  const pinyinHtml = addPinyinClient(text);

  // OpenRouter for translation
  const promptMessages = buildChinesePrompt(text, 'translate');
  const raw = await callOpenRouter(promptMessages, model, 0.3);

  let malay = '';
  let english = '';

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
    malay = parsed.malay || '';
    english = parsed.english || '';
  } catch {
    // Fallback: if JSON fails, use raw text as both
    malay = raw.slice(0, 500);
    english = raw.slice(0, 500);
  }

  return { original: text, pinyinHtml, malay, english };
}
