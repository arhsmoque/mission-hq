import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAnnotateChinese, useSaveVocab } from '@/features/chinese/useChinese';
import PinyinRuby from '@/features/chinese/PinyinRuby';
import VocabBank from '@/features/chinese/VocabBank';
import FlashcardQuiz from '@/features/chinese/FlashcardQuiz';
import { useRootStore } from '@/stores/rootStore';

export default function ChineseLab() {
  const navigate = useNavigate();
  const selectedModel = useRootStore((s) => s.selectedModel);

  const [input, setInput] = useState('');
  const [result, setResult] = useState<{
    original: string;
    pinyinHtml: string;
    malay: string;
    english: string;
  } | null>(null);
  const [activeTab, setActiveTab] = useState<'translate' | 'vocab' | 'flashcard'>('translate');

  const annotate = useAnnotateChinese();
  const saveVocab = useSaveVocab();

  const handleAnnotate = async () => {
    if (!input.trim()) return;
    const res = await annotate.mutateAsync({ text: input.trim(), model: selectedModel });
    setResult(res);
  };

  const handleSave = () => {
    if (!result) return;
    saveVocab.mutate({
      character: result.original,
      pinyin: result.pinyinHtml.replace(/<[^>]+>/g, ''),
      malay: result.malay,
      english: result.english,
    });
  };

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button onClick={() => navigate(-1)} className="mb-4 text-text-2">
        Back
      </button>
      <h1 className="font-display text-2xl font-black text-primary mb-2">
        Chinese Language Lab
      </h1>
      <p className="text-text-3 mb-6">Pinyin, translation, and vocab practice</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {(['translate', 'vocab', 'flashcard'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize ${
              activeTab === tab
                ? 'bg-accent text-white'
                : 'bg-bg-2 text-text-2'
            }`}
          >
            {tab === 'flashcard' ? 'Flashcards' : tab}
          </button>
        ))}
      </div>

      {activeTab === 'translate' && (
        <div className="space-y-4">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste Chinese text here..."
            rows={4}
            className="w-full rounded-xl border border-border bg-surface p-4 text-lg text-text focus:border-accent focus:outline-none resize-y"
          />
          <button
            onClick={handleAnnotate}
            disabled={annotate.isPending || !input.trim()}
            className="w-full rounded-xl bg-accent py-3 font-bold text-white disabled:opacity-50"
          >
            {annotate.isPending ? 'Processing...' : 'Add Pinyin & Translate'}
          </button>

          {result && (
            <div className="space-y-4">
              <PinyinRuby html={result.pinyinHtml} />

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-surface p-4 border border-border">
                  <p className="text-xs text-text-3 mb-1">Malay</p>
                  <p className="font-semibold text-primary">{result.malay}</p>
                </div>
                <div className="rounded-xl bg-surface p-4 border border-border">
                  <p className="text-xs text-text-3 mb-1">English</p>
                  <p className="font-semibold text-primary">{result.english}</p>
                </div>
              </div>

              <button
                onClick={handleSave}
                disabled={saveVocab.isPending}
                className="w-full rounded-xl bg-green py-3 font-bold text-white"
              >
                {saveVocab.isPending ? 'Saving...' : 'Save to Vocab Bank'}
              </button>
            </div>
          )}
        </div>
      )}

      {activeTab === 'vocab' && <VocabBank />}
      {activeTab === 'flashcard' && <FlashcardQuiz />}
    </div>
  );
}
