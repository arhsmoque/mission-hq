import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRootStore } from '@/stores/rootStore';
import { useLesson } from '@/features/lesson/useLessons';
import { analyticsAdapter } from '@/adapters';
import { SUBJECT_LABELS } from '@/types';
import type { LessonActivityType } from '@/types';

const ACTIVITY_EMOJI: Record<LessonActivityType, string> = {
  recall: '🧠',
  guided_practice: '🤝',
  independent_practice: '✏️',
  reflection: '💭',
  creative: '🎨',
};

export default function LessonPlayer() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const user = useRootStore((s) => s.user);
  const profileId = useRootStore((s) => s.profileId);
  const addBadge = useRootStore((s) => s.addBadge);
  const { lesson, loading } = useLesson(lessonId);
  const [activeSectionIdx, setActiveSectionIdx] = useState(0);
  const [completedSections, setCompletedSections] = useState<Set<string>>(new Set());
  const [hintsUsed, setHintsUsed] = useState(0);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showCompletion, setShowCompletion] = useState(false);

  const approvedSections = lesson?.sections.filter((s) => s.status === 'approved') ?? [];
  const activeSection = approvedSections[activeSectionIdx];
  const progress = approvedSections.length > 0
    ? Math.round((completedSections.size / approvedSections.length) * 100)
    : 0;

  // Start analytics session when opening a section
  useEffect(() => {
    if (!user?.uid || !profileId || !lessonId || !activeSection) return;
    let cancelled = false;
    analyticsAdapter
      .startSession({
        uid: user.uid,
        profileId,
        lessonId,
        sectionId: activeSection.sectionId,
        methodId: activeSection.methodId,
        subject: lesson?.subject ?? 'mixed',
        startedAt: Date.now(),
        chatTurnsUsed: 0,
        hintsRequested: 0,
        completedWithoutHelp: false,
        successIndicator: false,
      })
      .then((id) => {
        if (!cancelled) setSessionId(id);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, profileId, lessonId, activeSection?.sectionId, lesson?.subject]);

  const handleCompleteSection = useCallback(async () => {
    if (!user?.uid || !sessionId || !activeSection) return;
    const completedWithoutHelp = hintsUsed === 0;
    await analyticsAdapter.completeSession(user.uid, sessionId, {
      chatTurnsUsed: 0,
      hintsRequested: hintsUsed,
      completedWithoutHelp,
      successIndicator: true,
    });
    setCompletedSections((prev) => new Set([...prev, activeSection.sectionId]));
    setHintsUsed(0);
    setSessionId(null);
    if (activeSectionIdx < approvedSections.length - 1) {
      setActiveSectionIdx((i) => i + 1);
    } else {
      setShowCompletion(true);
      addBadge(`Lesson Master`);
    }
  }, [user?.uid, sessionId, activeSection, activeSectionIdx, approvedSections.length, hintsUsed, addBadge]);

  const handleHint = useCallback(() => {
    setHintsUsed((h) => h + 1);
  }, []);

  if (lesson && !lesson.parentReviewed) {
    return <div className="p-6 max-w-xl mx-auto text-center mt-20 bg-surface rounded-2xl border border-border"><h2 className="text-xl font-black text-red font-display">Wait! 🛑</h2><p className="text-text-2 mt-2">Your parent needs to review this lesson before you can start.</p></div>;
  }

  if (loading)
    return (
      <div className="p-6 max-w-xl mx-auto text-text-3 flex h-screen items-center justify-center">
        Loading lesson…
      </div>
    );
  if (!lesson)
    return (
      <div className="p-6 max-w-xl mx-auto text-red">Lesson not found.</div>
    );

  if (approvedSections.length === 0) {
    return (
      <div className="p-6 max-w-xl mx-auto flex flex-col items-center justify-center h-[60vh]">
        <span className="text-4xl mb-3">🔒</span>
        <h2 className="font-display text-xl font-bold text-primary">
          Not Ready Yet
        </h2>
        <p className="text-sm text-text-2 mt-2 text-center">
          This lesson is still being reviewed by your parent. Check back soon!
        </p>
        <button
          onClick={() => navigate('/')}
          className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-bold text-white"
        >
          Go Home
        </button>
      </div>
    );
  }

  if (showCompletion) {
    return (
      <div className="p-6 max-w-xl mx-auto flex flex-col items-center justify-center h-[80vh]">
        <span className="text-6xl mb-4">🎉</span>
        <h2 className="font-display text-3xl font-black text-primary">
          You Did It!
        </h2>
        <p className="text-sm text-text-2 mt-2 text-center">
          You completed <strong>{lesson.title}</strong>!
        </p>
        <div className="mt-4 flex gap-2">
          {Array.from({ length: approvedSections.length }).map((_, i) => (
            <span key={i} className="text-2xl">
              ⭐
            </span>
          ))}
        </div>
        <button
          onClick={() => navigate('/')}
          className="mt-6 rounded-xl bg-accent px-6 py-3 text-sm font-bold text-white shadow-lg active:scale-[0.98] transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button
        onClick={() => navigate('/')}
        className="mb-4 text-text-2 text-sm"
      >
        ← Home
      </button>

      <div className="mb-4">
        <h1 className="font-display text-xl font-black text-primary">
          {lesson.title}
        </h1>
        <p className="text-xs text-text-3">
          {(SUBJECT_LABELS as Record<string, string>)[lesson.subject] ??
            lesson.subject}
        </p>
      </div>

      {/* Progress bar */}
      <div className="rounded-2xl bg-bg-2 border border-border p-3 mb-4">
        <div className="flex items-center justify-between mb-1">
          <span className="text-xs font-semibold text-text-2">
            Your Progress
          </span>
          <span className="text-xs font-bold text-accent">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-bg overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex gap-1 mt-2">
          {approvedSections.map((s, i) => (
            <span
              key={s.sectionId}
              className={`text-xs rounded-full w-6 h-6 flex items-center justify-center font-bold ${
                i === activeSectionIdx
                  ? 'bg-accent text-white'
                  : completedSections.has(s.sectionId)
                  ? 'bg-green text-white'
                  : 'bg-bg text-text-3'
              }`}
            >
              {completedSections.has(s.sectionId) ? '✓' : i + 1}
            </span>
          ))}
        </div>
      </div>

      {/* Section card */}
      {activeSection && (
        <div className="rounded-2xl bg-bg-2 border border-border p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-lg">📖</span>
            <h2 className="text-sm font-bold text-text">
              {activeSection.title}
            </h2>
          </div>

          {activeSection.learningObjective && (
            <div className="rounded-xl bg-accent/5 border border-accent/20 p-3 mb-3">
              <p className="text-[10px] text-accent font-bold uppercase tracking-wide">
                Learning Goal
              </p>
              <p className="text-xs text-text-2 mt-0.5">
                {activeSection.learningObjective}
              </p>
            </div>
          )}

          {/* Activities */}
          <div className="space-y-3">
            {activeSection.activities?.map((act, i) => (
              <ActivityCard
                key={i}
                activity={act}
                index={i}
                onHint={handleHint}
              />
            ))}
          </div>

          {/* Complete button */}
          <button
            onClick={handleCompleteSection}
            className="w-full mt-4 rounded-xl bg-green py-3 text-sm font-bold text-white shadow-lg active:scale-[0.98] transition-all"
          >
            ✨ I Finished This Section!
          </button>
        </div>
      )}
    </div>
  );
}

function ActivityCard({
  activity,
  onHint,
}: {
  activity: {
    type: LessonActivityType;
    instruction: string;
    hint: string;
    successCriteria: string;
  };
  index: number;
  onHint: () => void;
}) {
  const [showHint, setShowHint] = useState(false);

  return (
    <div className="rounded-xl bg-bg border border-border p-3">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{ACTIVITY_EMOJI[activity.type]}</span>
        <span className="text-xs font-bold text-text capitalize">
          {activity.type.replace('_', ' ')}
        </span>
      </div>
      <p className="text-sm text-text-2 leading-relaxed">
        {activity.instruction}
      </p>

      <div className="flex gap-2 mt-2">
        <button
          onClick={() => {
            setShowHint(true);
            onHint();
          }}
          className="text-[10px] bg-accent/10 text-accent border border-accent/30 rounded-lg px-2 py-1 hover:bg-accent/20 transition-colors"
        >
          💡 Need a hint?
        </button>
      </div>

      {showHint && (
        <div className="mt-2 rounded-lg bg-accent/5 border border-accent/20 p-2">
          <p className="text-xs text-text-2">{activity.hint}</p>
        </div>
      )}

      <p className="text-[10px] text-green mt-2">
        ✓ Success: {activity.successCriteria}
      </p>
    </div>
  );
}
