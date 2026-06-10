import { useState, useEffect } from 'react';
import { getReviewContent } from '@/lib/dailyAgenda';
import type { AgendaItem } from '@/types';

function SimpleMarkdown({ text }: { text: string }) {
  return (
    <div className="space-y-1 text-sm leading-relaxed">
      {text.split('\n').map((line, i) => {
        if (line.startsWith('## ')) {
          return <h2 key={i} className="font-bold text-base text-text mt-4 first:mt-0">{line.slice(3)}</h2>;
        }
        if (line.startsWith('### ')) {
          return <h3 key={i} className="font-semibold text-text mt-3">{line.slice(4)}</h3>;
        }
        if (line.startsWith('- ') || line.startsWith('* ')) {
          const content = line.slice(2);
          const parts   = content.split(/(\*\*[^*]+\*\*)/g);
          return (
            <div key={i} className="flex gap-2 text-text-2 pl-2">
              <span className="text-accent shrink-0">•</span>
              <span>{parts.map((p, j) =>
                p.startsWith('**') && p.endsWith('**')
                  ? <strong key={j} className="text-text font-semibold">{p.slice(2, -2)}</strong>
                  : p
              )}</span>
            </div>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        const parts = line.split(/(\*\*[^*]+\*\*)/g);
        return (
          <p key={i} className="text-text-2">
            {parts.map((p, j) =>
              p.startsWith('**') && p.endsWith('**')
                ? <strong key={j} className="text-text font-semibold">{p.slice(2, -2)}</strong>
                : p
            )}
          </p>
        );
      })}
    </div>
  );
}

interface Props {
  item: AgendaItem;
  profileId: string;
  onDone: () => void;
}

export default function ReviewActivity({ item, profileId, onDone }: Props) {
  const { campaign, session } = item;
  const [content, setContent]   = useState<string | null>(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);

  useEffect(() => {
    if (!campaign.resourceId) {
      setContent('No textbook linked to this campaign. Review your notes manually.');
      setLoading(false);
      return;
    }
    setLoading(true);
    getReviewContent(
      campaign.campaignId,
      session.sessionIdx,
      session,
      campaign.resourceId,
      campaign.resourceLabel ?? campaign.label,
      profileId,
    )
      .then((md) => { setContent(md); setLoading(false); })
      .catch((err) => { setError(String(err)); setLoading(false); });
  }, [campaign.campaignId, session.sessionIdx]);

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl bg-surface border border-border px-4 py-3">
        <p className="text-xs text-text-3 mb-1">📖 Review — {session.sectionTitle}</p>
        <p className="text-xs text-text-3">Pages {session.pageStart}–{session.pageEnd}</p>
      </div>

      {loading && (
        <div className="rounded-2xl bg-bg-2 border border-border px-4 py-8 text-center">
          <div className="flex justify-center gap-1 mb-3">
            {[0, 150, 300].map((d) => (
              <div key={d} className="w-2 h-2 rounded-full bg-accent animate-bounce" style={{ animationDelay: `${d}ms` }} />
            ))}
          </div>
          <p className="text-sm text-text-3">Preparing your study guide…</p>
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-red/10 border border-red/30 px-4 py-3 text-sm text-red">{error}</div>
      )}

      {content && !loading && (
        <div className="rounded-2xl bg-bg-2 border border-border px-4 py-4">
          <SimpleMarkdown text={content} />
        </div>
      )}

      <button
        onClick={onDone}
        disabled={loading}
        className="w-full rounded-2xl bg-green px-6 py-4 font-bold text-white text-base active:scale-[0.98] transition-transform disabled:opacity-40"
      >
        Understood! ✓  (+10 XP)
      </button>
    </div>
  );
}
