import { useState } from 'react';
import { useVocabBank } from './useChinese';

export default function FlashcardQuiz() {
  const { data: vocab = [] } = useVocabBank();
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [direction, setDirection] = useState<'zh-to-ms' | 'ms-to-zh'>('zh-to-ms');

  const cards = vocab.length > 0 ? vocab : [
    { character: '苹果', pinyin: 'píng guǒ', malay: 'epal', english: 'apple', vocabId: 'demo1' },
    { character: '书本', pinyin: 'shū běn', malay: 'buku', english: 'book', vocabId: 'demo2' },
  ];

  const current = cards[index % cards.length];

  const next = () => {
    setFlipped(false);
    setIndex((i) => (i + 1) % cards.length);
  };

  const front = direction === 'zh-to-ms' ? current.character : current.malay;
  const back = direction === 'zh-to-ms'
    ? `${current.pinyin}\n${current.malay}`
    : `${current.character}\n${current.pinyin}`;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-semibold text-primary">Flashcards</h3>
        <button
          onClick={() => {
            setDirection((d) => (d === 'zh-to-ms' ? 'ms-to-zh' : 'zh-to-ms'));
            setFlipped(false);
          }}
          className="text-xs bg-bg-2 px-3 py-1 rounded-full text-text-2"
        >
          {direction === 'zh-to-ms' ? 'CN → MS' : 'MS → CN'}
        </button>
      </div>

      <button
        onClick={() => setFlipped(!flipped)}
        className={`w-full rounded-2xl p-8 text-center border-2 transition-all min-h-[180px] flex flex-col items-center justify-center ${
          flipped
            ? 'bg-accent/10 border-accent'
            : 'bg-surface border-border'
        }`}
      >
        <p className="text-3xl font-bold text-primary whitespace-pre-line">
          {flipped ? back : front}
        </p>
        <p className="mt-3 text-xs text-text-3">
          {flipped ? 'Tap to see question' : 'Tap to reveal answer'}
        </p>
      </button>

      <button
        onClick={next}
        className="w-full rounded-xl bg-bg-2 py-3 font-semibold text-text active:scale-[0.98]"
      >
        Next Card
      </button>
    </div>
  );
}
