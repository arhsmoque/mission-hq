import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildDailyAgenda } from '@/lib/dailyAgenda';
import { addXP, getXP } from '@/lib/gamification';
import { campaignStorage } from '@/adapters';
import { useRootStore } from '@/stores/rootStore';
import { PROFILES } from '@/features/profile/profiles';
import ReviewActivity from './ReviewActivity';
import PracticeActivity from './PracticeActivity';
import QuizActivity from './QuizActivity';
import type { DailyAgenda, AgendaItem, SessionActivityType } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────

type View =
  | { mode: 'agenda' }
  | { mode: 'activity'; item: AgendaItem; activityType: SessionActivityType };

// Local tracking: which activities are done in this session visit
type ActivityDoneMap = Record<string, Set<SessionActivityType>>;

function sessionKey(item: AgendaItem) {
  return `${item.campaign.campaignId}_${item.session.sessionIdx}`;
}

const ACTIVITY_LABELS: Record<SessionActivityType, string> = {
  review:   '📖 Review',
  practice: '✏️ Practice',
  quiz:     '⚡ Quiz',
};

const ACTIVITY_XP: Record<SessionActivityType, number> = {
  review:   10,
  practice: 20,
  quiz:     30,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function daysUntil(deadline: number): number {
  return Math.max(0, Math.ceil((deadline - Date.now()) / 86_400_000));
}

function deadlineBadgeColor(days: number): string {
  if (days <= 2)  return 'bg-red/20 text-red border-red/30';
  if (days <= 7)  return 'bg-yellow/20 text-yellow border-yellow/30';
  return 'bg-green/20 text-green border-green/30';
}

// ── Agenda card ────────────────────────────────────────────────────────────

function AgendaCard({
  item,
  doneSets,
  onStartActivity,
  onMarkComplete,
  completing,
}: {
  item: AgendaItem;
  doneSets: Set<SessionActivityType>;
  onStartActivity: (item: AgendaItem, type: SessionActivityType) => void;
  onMarkComplete: (item: AgendaItem) => void;
  completing: boolean;
}) {
  const { campaign, session, isOverdue } = item;
  const days         = daysUntil(campaign.deadline);
  const activities   = session.activityTypes;
  const allLocalDone = activities.every((a) => doneSets.has(a));
  const sessionDone  = session.status === 'done';

  return (
    <div className={`rounded-2xl border px-4 py-4 space-y-3 ${
      sessionDone ? 'bg-bg-2 border-border opacity-60' : 'bg-surface border-border'
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {isOverdue && (
            <span className="text-[10px] font-semibold text-red uppercase tracking-wide">Overdue · </span>
          )}
          <p className="text-xs text-text-3 truncate">{campaign.label}</p>
          <p className="font-semibold text-text text-sm leading-tight mt-0.5 truncate">{session.sectionTitle}</p>
          {campaign.resourceLabel && (
            <p className="text-[11px] text-text-3 mt-0.5 truncate">{campaign.resourceLabel} · pp.{session.pageStart}–{session.pageEnd}</p>
          )}
        </div>
        <span className={`shrink-0 rounded-lg border px-2 py-1 text-[11px] font-semibold ${deadlineBadgeColor(days)}`}>
          {days === 0 ? 'Today!' : `${days}d`}
        </span>
      </div>

      {/* Activity buttons */}
      <div className="flex gap-2">
        {activities.map((type) => {
          const localDone = doneSets.has(type);
          return (
            <button
              key={type}
              onClick={() => !sessionDone && onStartActivity(item, type)}
              disabled={sessionDone}
              className={`flex-1 rounded-xl py-2 text-xs font-semibold border transition-colors ${
                localDone
                  ? 'bg-green/15 border-green/40 text-green'
                  : 'bg-bg-2 border-border text-text-2 hover:border-accent hover:text-accent active:scale-[0.97]'
              } disabled:cursor-default`}
            >
              {localDone ? '✓ ' : ''}{ACTIVITY_LABELS[type]}
            </button>
          );
        })}
      </div>

      {/* Mark complete */}
      {!sessionDone && allLocalDone && (
        <button
          onClick={() => onMarkComplete(item)}
          disabled={completing}
          className="w-full rounded-xl bg-green px-4 py-2.5 text-sm font-bold text-white active:scale-[0.98] transition-transform disabled:opacity-50"
        >
          {completing ? 'Saving…' : 'Mark session complete ✓'}
        </button>
      )}

      {sessionDone && (
        <p className="text-center text-xs text-green font-semibold">✓ Completed</p>
      )}
    </div>
  );
}

// ── Main screen ────────────────────────────────────────────────────────────

export default function TodayScreen() {
  const navigate    = useNavigate();
  const user        = useRootStore((s) => s.user);
  const profileId   = useRootStore((s) => s.profileId);
  const profile     = PROFILES.find((p) => p.id === profileId);

  const [agenda, setAgenda]         = useState<DailyAgenda | null>(null);
  const [loading, setLoading]       = useState(true);
  const [xp, setXp]                 = useState(0);
  const [view, setView]             = useState<View>({ mode: 'agenda' });
  const [doneSets, setDoneSets]     = useState<ActivityDoneMap>({});
  const [completing, setCompleting] = useState<string | null>(null);

  const loadAgenda = useCallback(async () => {
    if (!profileId) return;
    setLoading(true);
    const [ag, totalXp] = await Promise.all([
      buildDailyAgenda(profileId),
      user?.uid ? getXP(user.uid) : Promise.resolve(0),
    ]);
    setAgenda(ag);
    setXp(totalXp);
    setLoading(false);
  }, [profileId, user?.uid]);

  useEffect(() => { loadAgenda(); }, [loadAgenda]);

  function startActivity(item: AgendaItem, type: SessionActivityType) {
    setView({ mode: 'activity', item, activityType: type });
  }

  async function handleActivityDone(item: AgendaItem, type: SessionActivityType, score?: number) {
    const key = sessionKey(item);
    setDoneSets((prev) => {
      const next = new Set(prev[key] ?? []);
      next.add(type);
      return { ...prev, [key]: next };
    });
    // Award XP immediately
    if (user?.uid) {
      const earned = type === 'quiz' && score != null
        ? 15 + Math.round(30 * (score / 100))
        : ACTIVITY_XP[type];
      const newTotal = await addXP(user.uid, earned);
      setXp(newTotal);
    }
    setView({ mode: 'agenda' });
  }

  async function markSessionComplete(item: AgendaItem) {
    const key = sessionKey(item);
    setCompleting(key);
    try {
      await campaignStorage.updateSession(
        item.campaign.campaignId,
        item.session.sessionIdx,
        { status: 'done', completedAt: Date.now() },
      );
      await loadAgenda();
    } finally {
      setCompleting(null);
    }
  }

  // ── Activity view ──────────────────────────────────────────────────────

  if (view.mode === 'activity') {
    const { item, activityType } = view;
    const pid = profileId ?? 'haidar';

    return (
      <div className="p-4 max-w-xl mx-auto">
        <button
          onClick={() => setView({ mode: 'agenda' })}
          className="flex items-center gap-2 text-sm text-text-2 mb-4 hover:text-text transition-colors"
        >
          ← Back to today
        </button>

        <div className="mb-4">
          <p className="text-xs text-text-3 uppercase tracking-wide font-semibold">
            {ACTIVITY_LABELS[activityType]}
          </p>
          <h2 className="font-bold text-lg text-text leading-tight">{item.session.sectionTitle}</h2>
          <p className="text-xs text-text-3 mt-0.5">{item.campaign.label}</p>
        </div>

        {activityType === 'review' && (
          <ReviewActivity
            item={item}
            profileId={pid}
            onDone={() => handleActivityDone(item, 'review')}
          />
        )}
        {activityType === 'practice' && (
          <PracticeActivity
            item={item}
            profileId={pid}
            onDone={(score) => handleActivityDone(item, 'practice', score)}
          />
        )}
        {activityType === 'quiz' && (
          <QuizActivity
            item={item}
            profileId={pid}
            onDone={(score) => handleActivityDone(item, 'quiz', score)}
          />
        )}
      </div>
    );
  }

  // ── Agenda view ────────────────────────────────────────────────────────

  return (
    <div className="p-4 max-w-xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="font-display text-2xl font-black text-primary leading-tight">
            Today's Plan {profile?.emoji}
          </h1>
          <p className="text-sm text-text-2 mt-0.5" style={{ color: profile?.color }}>
            {profile?.name}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-text-3">Total XP</p>
          <p className="text-xl font-black text-accent">⚡ {xp}</p>
        </div>
      </div>

      <button
        onClick={() => navigate('/')}
        className="flex items-center gap-1 text-xs text-text-3 mb-5 hover:text-text transition-colors"
      >
        ← Home
      </button>

      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface border border-border h-28 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && agenda && (
        <>
          {/* Today's items */}
          {agenda.items.length === 0 ? (
            <div className="rounded-2xl bg-surface border border-border px-4 py-8 text-center mb-4">
              <p className="text-3xl mb-2">🎉</p>
              <p className="font-bold text-text">All caught up for today!</p>
              <p className="text-sm text-text-3 mt-1">Check back tomorrow for your next session.</p>
            </div>
          ) : (
            <div className="space-y-3 mb-4">
              {agenda.items.map((item, i) => (
                <AgendaCard
                  key={i}
                  item={item}
                  doneSets={doneSets[sessionKey(item)] ?? new Set()}
                  onStartActivity={startActivity}
                  onMarkComplete={markSessionComplete}
                  completing={completing === sessionKey(item)}
                />
              ))}
            </div>
          )}

          {/* Upcoming */}
          {agenda.upcomingItems.length > 0 && (
            <div className="mt-2">
              <p className="text-xs text-text-3 uppercase tracking-wide font-semibold mb-2">Coming up</p>
              <div className="space-y-2">
                {agenda.upcomingItems.slice(0, 3).map((item, i) => {
                  const days = daysUntil(item.session.targetDate);
                  return (
                    <div key={i} className="rounded-xl bg-bg-2 border border-border px-3 py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs text-text-3 truncate">{item.campaign.label}</p>
                        <p className="text-sm text-text truncate">{item.session.sectionTitle}</p>
                      </div>
                      <span className="text-xs text-text-3 shrink-0">in {days}d</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* No campaigns at all */}
          {agenda.items.length === 0 && agenda.upcomingItems.length === 0 && (
            <div className="mt-4 rounded-2xl bg-bg-2 border border-border px-4 py-4 text-center">
              <p className="text-sm text-text-2">No active campaigns yet.</p>
              <p className="text-xs text-text-3 mt-1">Ask a parent to set up your study plan in the Admin chat.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
