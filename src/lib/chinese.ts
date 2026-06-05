import { html as pinyinHtml } from 'pinyin-pro';
import { aiAdapter } from '@/adapters';
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
  const localPinyin = addPinyinClient(text);

  const promptMessages = buildChinesePrompt(text, 'translate');
  const raw = await aiAdapter.chat(promptMessages, model, 0.3);

  let malay: string;
  let english: string;

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw) as {
      malay?: string;
      english?: string;
    };
    malay   = parsed.malay   ?? '';
    english = parsed.english ?? '';
  } catch {
    malay   = raw.slice(0, 500);
    english = raw.slice(0, 500);
  }

  return { original: text, pinyinHtml: localPinyin, malay, english };
}
