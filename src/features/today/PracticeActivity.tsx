import { useState, useEffect } from 'react';
import { getPracticeQuestions, evaluatePracticeAnswer } from '@/lib/dailyAgenda';
import type { AgendaItem, PracticeQuestion } from '@/types';

interface Props {
  item: AgendaItem;
  profileId: string;
  onDone: (score: number) => void;
}

export default function PracticeActivity({ item, profileId, onDone }: Props) {
  const { campaign, session } = item;

  const [questions, setQuestions]   = useState<PracticeQuestion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [answer, setAnswer]         = useState('');
  const [checking, setChecking]     = useState(false);
  const [feedback, setFeedback]     = useState<{ correct: boolean; text: string } | null>(null);
  const [results, setResults]       = useState<boolean[]>([]);

  const isFinished = results.length === questions.length && questions.length > 0;

  useEffect(() => {
    if (!campaign.resourceId) {
      setError('No textbook linked — practice questions unavailable.');
      setLoading(false);
      return;
    }
    setLoading(true);
    getPracticeQuestions(
      campaign.campaignId,
      session.sessionIdx,
      session,
      campaign.resourceId,
      campaign.resourceLabel ?? campaign.label,
      profileId,
    )
      .then((qs) => { setQuestions(qs); setLoading(false); })
      .catch((err) => { setError(String(err)); setLoading(false); });
  }, [campaign.campaignId, session.sessionIdx]);

  async function checkAnswer() {
    if (!answer.trim() || checking) return;
    setChecking(true);
    const q = questions[currentIdx];
    const result = await evaluatePracticeAnswer(q.question, q.answer, answer);
    setFeedback({ correct: result.correct, text: result.feedback });
    setResults((prev) => [...prev, result.correct]);
    setChecking(false);
  }

  function nextQuestion() {
    setFeedback(null);
    setAnswer('');
    setCurrentIdx((i) => i + 1);
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-bg-2 border border-border px-4 py-8 text-center">
        <div className="flex justify-center gap-1 mb-3">
          {[0, 150, 300].map((d) => (
            <div key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <p className="text-sm text-text-3">Preparing practice questions…</p>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-2xl bg-red/10 border border-red/30 px-4 py-3 text-sm text-red">{error}</div>;
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl bg-bg-2 border border-border px-4 py-6 text-center text-sm text-text-3">
        No questions generated. Try again later.
      </div>
    );
  }

  // Summary screen
  if (isFinished) {
    const correct = results.filter(Boolean).length;
    const pct     = Math.round((correct / questions.length) * 100);
    const xp      = 10 + Math.round(20 * (pct / 100));
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-surface border border-border px-4 py-6 text-center">
          <p className="text-4xl mb-2">{pct >= 80 ? '🌟' : pct >= 60 ? '👍' : '💪'}</p>
          <p className="text-2xl font-black text-text">{correct}/{questions.length}</p>
          <p className="text-text-2 mt-1">{pct}% correct</p>
          <div className="mt-3 flex justify-center gap-1">
            {results.map((r, i) => (
              <div key={i} className={`w-8 h-2 rounded-full ${r ? 'bg-green' : 'bg-red/50'}`} />
            ))}
          </div>
        </div>
        <button
          onClick={() => onDone(pct)}
          className="w-full rounded-2xl bg-green px-6 py-4 font-bold text-white text-base active:scale-[0.98] transition-transform"
        >
          Done! +{xp} XP
        </button>
      </div>
    );
  }

  const q = questions[currentIdx];

  return (
    <div className="flex flex-col gap-4">
      {/* Progress */}
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 bg-bg-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-accent rounded-full transition-all"
            style={{ width: `${(currentIdx / questions.length) * 100}%` }}
          />
        </div>
        <span className="text-xs text-text-3 shrink-0">{currentIdx + 1}/{questions.length}</span>
      </div>

      {/* Question */}
      <div className="rounded-2xl bg-surface border border-border px-4 py-4">
        <p className="text-xs text-accent font-semibold mb-2 uppercase tracking-wide">Question {currentIdx + 1}</p>
        <p className="text-base text-text font-medium leading-snug">{q.question}</p>
        {feedback === null && (
          <p className="text-xs text-text-3 mt-2">Hint: {q.hint}</p>
        )}
      </div>

      {/* Answer input */}
      {feedback === null ? (
        <>
          <textarea
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            placeholder="Type your answer here…"
            rows={3}
            disabled={checking}
            className="w-full rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder-text-3 focus:border-accent focus:outline-none resize-none disabled:opacity-50"
            style={{ minHeight: 'unset' }}
          />
          <button
            onClick={checkAnswer}
            disabled={!answer.trim() || checking}
            className="w-full rounded-2xl bg-accent px-6 py-4 font-bold text-bg text-base active:scale-[0.98] transition-transform disabled:opacity-40"
          >
            {checking ? 'Checking…' : 'Check Answer'}
          </button>
        </>
      ) : (
        <>
          <div className={`rounded-2xl border px-4 py-3 ${
            feedback.correct
              ? 'bg-green/10 border-green/40 text-green'
              : 'bg-red/10 border-red/30 text-red'
          }`}>
            <p className="font-semibold mb-1">{feedback.correct ? '✓ Correct!' : '✗ Not quite'}</p>
            <p className="text-sm">{feedback.text}</p>
            {!feedback.correct && (
              <p className="text-sm mt-1 opacity-75">Answer: {q.answer}</p>
            )}
          </div>
          <button
            onClick={nextQuestion}
            className="w-full rounded-2xl bg-accent px-6 py-4 font-bold text-bg text-base active:scale-[0.98] transition-transform"
          >
            {currentIdx + 1 < questions.length ? 'Next Question →' : 'See Results'}
          </button>
        </>
      )}
    </div>
  );
}
