import { useState, useEffect } from 'react';
import { getQuizQuestions } from '@/lib/dailyAgenda';
import type { AgendaItem, QuizQuestion } from '@/types';

interface Props {
  item: AgendaItem;
  profileId: string;
  onDone: (score: number) => void;
}

export default function QuizActivity({ item, profileId, onDone }: Props) {
  const { campaign, session } = item;

  const [questions, setQuestions]   = useState<QuizQuestion[]>([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState<string | null>(null);
  const [selected, setSelected]     = useState<(number | null)[]>([]);
  const [submitted, setSubmitted]   = useState(false);

  useEffect(() => {
    if (!campaign.resourceId) {
      setError('No textbook linked — quiz unavailable.');
      setLoading(false);
      return;
    }
    setLoading(true);
    getQuizQuestions(
      campaign.campaignId,
      session.sessionIdx,
      session,
      campaign.resourceId,
      campaign.resourceLabel ?? campaign.label,
      profileId,
    )
      .then((qs) => {
        setQuestions(qs);
        setSelected(new Array(qs.length).fill(null));
        setLoading(false);
      })
      .catch((err) => { setError(String(err)); setLoading(false); });
  }, [campaign.campaignId, session.sessionIdx]);

  function select(qIdx: number, optIdx: number) {
    if (submitted) return;
    setSelected((prev) => prev.map((v, i) => (i === qIdx ? optIdx : v)));
  }

  function submit() {
    if (selected.some((s) => s === null)) return;
    setSubmitted(true);
  }

  if (loading) {
    return (
      <div className="rounded-2xl bg-bg-2 border border-border px-4 py-8 text-center">
        <div className="flex justify-center gap-1 mb-3">
          {[0, 150, 300].map((d) => (
            <div key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${d}ms` }} />
          ))}
        </div>
        <p className="text-sm text-text-3">Preparing your quiz…</p>
      </div>
    );
  }

  if (error) {
    return <div className="rounded-2xl bg-red/10 border border-red/30 px-4 py-3 text-sm text-red">{error}</div>;
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-2xl bg-bg-2 border border-border px-4 py-6 text-center text-sm text-text-3">
        No quiz generated. Try again later.
      </div>
    );
  }

  const correctCount = submitted
    ? questions.filter((q, i) => selected[i] === q.correct).length
    : 0;
  const pct = submitted ? Math.round((correctCount / questions.length) * 100) : 0;
  const xp  = submitted ? 15 + Math.round(30 * (pct / 100)) : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Result banner */}
      {submitted && (
        <div className="rounded-2xl bg-surface border border-border px-4 py-4 text-center">
          <p className="text-4xl mb-1">{pct >= 80 ? '🏆' : pct >= 60 ? '🌟' : '💪'}</p>
          <p className="text-2xl font-black text-text">{correctCount}/{questions.length}</p>
          <p className="text-text-2 text-sm">{pct}% — +{xp} XP earned</p>
        </div>
      )}

      {/* Questions */}
      <div className="space-y-4">
        {questions.map((q, qi) => {
          const chosen    = selected[qi];
          const isCorrect = submitted && chosen === q.correct;
          const isWrong   = submitted && chosen !== null && chosen !== q.correct;

          return (
            <div
              key={qi}
              className={`rounded-2xl border px-4 py-4 transition-colors ${
                submitted
                  ? isCorrect ? 'border-green/40 bg-green/5'
                  : isWrong  ? 'border-red/30 bg-red/5'
                  : 'border-border bg-surface'
                  : 'border-border bg-surface'
              }`}
            >
              <p className="text-xs text-text-3 mb-2 font-semibold">Q{qi + 1}</p>
              <p className="text-sm text-text font-medium mb-3 leading-snug">{q.question}</p>

              <div className="space-y-2">
                {q.options.map((opt, oi) => {
                  const isChosen     = chosen === oi;
                  const isRightOpt   = submitted && oi === q.correct;
                  const isWrongChose = submitted && isChosen && oi !== q.correct;

                  return (
                    <button
                      key={oi}
                      onClick={() => select(qi, oi)}
                      disabled={submitted}
                      className={`w-full text-left rounded-xl px-3 py-2 text-sm border transition-colors ${
                        isRightOpt     ? 'bg-green/20 border-green/50 text-green font-semibold' :
                        isWrongChose   ? 'bg-red/20 border-red/40 text-red' :
                        isChosen       ? 'bg-accent/20 border-accent text-accent' :
                        'bg-bg-2 border-border text-text-2 hover:border-text-2'
                      } disabled:cursor-default`}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>

              {submitted && (
                <p className={`text-xs mt-3 ${isCorrect ? 'text-green' : 'text-text-3'}`}>
                  {q.explanation}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {!submitted ? (
        <button
          onClick={submit}
          disabled={selected.some((s) => s === null)}
          className="w-full rounded-2xl bg-accent px-6 py-4 font-bold text-bg text-base active:scale-[0.98] transition-transform disabled:opacity-40"
        >
          Submit Quiz ({selected.filter((s) => s !== null).length}/{questions.length} answered)
        </button>
      ) : (
        <button
          onClick={() => onDone(pct)}
          className="w-full rounded-2xl bg-green px-6 py-4 font-bold text-white text-base active:scale-[0.98] transition-transform"
        >
          Finish — +{xp} XP ⚡
        </button>
      )}
    </div>
  );
}
