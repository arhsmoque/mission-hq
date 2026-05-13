import { useVocabBank, useDeleteVocab } from './useChinese';

export default function VocabBank() {
  const { data: vocab = [], isLoading } = useVocabBank();
  const deleteVocab = useDeleteVocab();

  if (isLoading) return <p className="text-text-3">Loading vocab...</p>;

  if (vocab.length === 0) {
    return (
      <div className="rounded-2xl bg-surface p-8 text-center border border-border">
        <p className="text-4xl mb-2">📚</p>
        <p className="text-text-3">Your vocab bank is empty.</p>
        <p className="text-sm text-text-3 mt-1">Save words from the Chinese Lab!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="font-semibold text-primary">Saved Words ({vocab.length})</h3>
      {vocab.map((item) => (
        <div
          key={item.vocabId}
          className="rounded-xl bg-surface p-4 border border-border flex items-start justify-between gap-3"
        >
          <div className="flex-1">
            <p className="text-xl font-bold text-primary">{item.character}</p>
            <p className="text-sm text-text-2">{item.pinyin}</p>
            <div className="mt-2 flex gap-3 text-xs">
              <span className="rounded-md bg-bg-2 px-2 py-1 text-text-2">
                🇲🇾 {item.malay}
              </span>
              <span className="rounded-md bg-bg-2 px-2 py-1 text-text-2">
                🇬🇧 {item.english}
              </span>
            </div>
          </div>
          <button
            onClick={() => deleteVocab.mutate(item.vocabId)}
            className="text-red text-sm font-bold px-2"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}
