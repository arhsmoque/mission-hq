import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRootStore } from '@/stores/rootStore';
import { useLessons, useLesson } from '@/features/lesson/useLessons';
import { lessonStorage } from '@/adapters';
import { regenerateSection } from '@/lib/lessonGenerator';
import { SUBJECT_LABELS } from '@/types';
import type { LessonSection, LessonSectionStatus, LessonActivityType } from '@/types';

const STATUS_LABELS: Record<LessonSectionStatus, string> = {
  raw: 'Raw',
  generated: 'Generated',
  needs_review: 'Needs Review',
  approved: 'Approved',
};

const STATUS_COLORS: Record<LessonSectionStatus, string> = {
  raw: 'bg-text-3/10 text-text-3 border-text-3/20',
  generated: 'bg-accent/10 text-accent border-accent/30',
  needs_review: 'bg-red/10 text-red border-red/30',
  approved: 'bg-green/10 text-green border-green/30',
};

const ACTIVITY_EMOJI: Record<LessonActivityType, string> = {
  recall: '🧠',
  guided_practice: '🤝',
  independent_practice: '✏️',
  reflection: '💭',
  creative: '🎨',
};

export default function LessonBuilder() {
  const { lessonId } = useParams<{ lessonId?: string }>();
  return lessonId ? <LessonDetail lessonId={lessonId} /> : <LessonList />;
}

// ── List View ─────────────────────────────────────────────────────────────────

function LessonList() {
  const navigate = useNavigate();
  const { lessons, loading } = useLessons();

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button onClick={() => navigate(-1)} className="mb-4 text-text-2 text-sm">
        ← Back
      </button>
      <h1 className="font-display text-2xl font-black text-primary mb-6">
        📚 Lesson Builder
      </h1>

      {loading && <p className="text-text-3 text-sm">Loading lessons…</p>}

      {!loading && lessons.length === 0 && (
        <div className="rounded-2xl bg-bg-2 border border-border p-6 text-center">
          <p className="text-3xl mb-2">📖</p>
          <p className="text-sm text-text-2">No lessons yet.</p>
          <p className="text-xs text-text-3 mt-1">
            Generate lessons from the Resource Directory in Admin → Directory.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {lessons.map((lesson) => {
          const total = lesson.sections.length;
          const approved = lesson.sections.filter((s) => s.status === 'approved').length;
          const needsReview = lesson.sections.filter((s) => s.status === 'needs_review').length;
          const progress = total > 0 ? Math.round((approved / total) * 100) : 0;

          return (
            <button
              key={lesson.lessonId}
              onClick={() => navigate(`/lesson-builder/${lesson.lessonId}`)}
              className="w-full text-left rounded-2xl bg-bg-2 border border-border p-4 hover:border-accent transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-text">{lesson.title}</span>
                <span
                  className={`text-xs font-medium rounded px-2 py-0.5 ${
                    lesson.parentReviewed ? 'bg-green/10 text-green' : 'bg-text-3/10 text-text-3'
                  }`}
                >
                  {lesson.parentReviewed ? '✅ Reviewed' : '🔍 In Review'}
                </span>
              </div>
              <p className="text-xs text-text-3 mt-1">
                {(SUBJECT_LABELS as Record<string, string>)[lesson.subject] ?? lesson.subject}
              </p>
              <div className="mt-3">
                <div className="h-1.5 rounded-full bg-bg overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent transition-all"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[10px] text-text-3">
                    {approved}/{total} approved
                  </span>
                  {needsReview > 0 && (
                    <span className="text-[10px] text-red">
                      {needsReview} needs review
                    </span>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Detail View ───────────────────────────────────────────────────────────────

function LessonDetail({ lessonId }: { lessonId: string }) {
  const navigate = useNavigate();
  const user = useRootStore((s) => s.user);
  const { lesson, loading } = useLesson(lessonId);
  const [regenerating, setRegenerating] = useState<Record<string, boolean>>({});
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});
  const [showReject, setShowReject] = useState<Record<string, boolean>>({});

  if (loading)
    return (
      <div className="p-6 max-w-xl mx-auto text-text-3">
        Loading lesson…
      </div>
    );
  if (!lesson)
    return (
      <div className="p-6 max-w-xl mx-auto text-red">Lesson not found.</div>
    );

  const total = lesson.sections.length;
  const approved = lesson.sections.filter((s) => s.status === 'approved').length;
  const progress = total > 0 ? Math.round((approved / total) * 100) : 0;
  const allApproved = approved === total && total > 0;

  async function handleApprove(sectionId: string) {
    if (!user) return;
    await lessonStorage.updateSection(user.uid, lessonId, sectionId, {
      status: 'approved',
      reviewedAt: Date.now(),
    });
  }

  async function handleReject(sectionId: string) {
    if (!user) return;
    await lessonStorage.updateSection(user.uid, lessonId, sectionId, {
      status: 'needs_review',
      parentNotes: rejectNotes[sectionId] || 'Marked for review by parent',
      reviewedAt: Date.now(),
    });
    setShowReject((prev) => ({ ...prev, [sectionId]: false }));
  }

  async function handleRegenerate(section: LessonSection) {
    if (!user) return;
    setRegenerating((prev) => ({ ...prev, [section.sectionId]: true }));
    try {
      await regenerateSection(user.uid, lessonId, section);
    } finally {
      setRegenerating((prev) => ({ ...prev, [section.sectionId]: false }));
    }
  }

  async function handleMarkReviewed() {
    if (!user) return;
    await lessonStorage.updateLesson(user.uid, lessonId, {
      parentReviewed: true,
      updatedAt: Date.now(),
    });
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button
        onClick={() => navigate('/lesson-builder')}
        className="mb-4 text-text-2 text-sm"
      >
        ← Back to Lessons
      </button>

      <div className="mb-6">
        <h1 className="font-display text-2xl font-black text-primary">
          {lesson.title}
        </h1>
        <p className="text-xs text-text-3 mt-1">
          {(SUBJECT_LABELS as Record<string, string>)[lesson.subject] ?? lesson.subject} ·{' '}
          {lesson.pageCount} pages
        </p>
      </div>

      {/* Progress */}
      <div className="rounded-2xl bg-bg-2 border border-border p-4 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-text-2">Approval Progress</span>
          <span className="text-xs font-bold text-accent">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-bg overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex gap-2 mt-2 flex-wrap">
          {lesson.sections.map((s) => (
            <span
              key={s.sectionId}
              className={`text-[10px] rounded px-1.5 py-0.5 font-medium ${STATUS_COLORS[s.status]}`}
            >
              {STATUS_LABELS[s.status]}
            </span>
          ))}
        </div>
      </div>

      {/* Mark reviewed */}
      {allApproved && !lesson.parentReviewed && (
        <button
          onClick={handleMarkReviewed}
          className="w-full rounded-xl bg-green py-2.5 text-sm font-bold text-white mb-6 shadow-lg active:scale-[0.98] transition-all"
        >
          ✅ Mark Parent Reviewed — Ready for Kids!
        </button>
      )}

      {lesson.parentReviewed && (
        <div className="rounded-xl bg-green/10 border border-green/30 p-3 mb-6 text-center">
          <p className="text-sm font-bold text-green">✅ Parent Reviewed</p>
          <p className="text-xs text-green/80 mt-0.5">
            This lesson is available to children.
          </p>
        </div>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {lesson.sections.map((section) => (
          <div
            key={section.sectionId}
            className="rounded-2xl bg-bg-2 border border-border p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-text">
                  {section.title}
                </h3>
                <p className="text-[10px] text-text-3">
                  Pages {section.pageStart}–{section.pageEnd}
                </p>
              </div>
              <span
                className={`text-[10px] font-medium rounded px-2 py-0.5 shrink-0 ${STATUS_COLORS[section.status]}`}
              >
                {STATUS_LABELS[section.status]}
              </span>
            </div>

            {/* Activities preview */}
            {(section.status === 'generated' ||
              section.status === 'needs_review' ||
              section.status === 'approved') &&
              section.activities && (
                <div className="mt-3 space-y-2">
                  {section.activities.map((act, i) => (
                    <div
                      key={i}
                      className="rounded-xl bg-bg border border-border p-3"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm">
                          {ACTIVITY_EMOJI[act.type]}
                        </span>
                        <span className="text-xs font-semibold text-text capitalize">
                          {act.type.replace('_', ' ')}
                        </span>
                      </div>
                      <p className="text-xs text-text-2">{act.instruction}</p>
                      <p className="text-[10px] text-text-3 mt-1">
                        💡 {act.hint}
                      </p>
                      <p className="text-[10px] text-green mt-1">
                        ✓ {act.successCriteria}
                      </p>
                    </div>
                  ))}
                </div>
              )}

            {section.learningObjective && (
              <p className="text-xs text-text-2 mt-2">
                🎯 {section.learningObjective}
              </p>
            )}

            {section.parentNotes && (
              <div className="mt-2 rounded-lg bg-red/5 border border-red/20 p-2">
                <p className="text-[10px] text-red font-medium">Parent note:</p>
                <p className="text-xs text-red/80">{section.parentNotes}</p>
              </div>
            )}

            {/* Evaluation log toggle */}
            {section.evaluationLog && section.evaluationLog.length > 0 && (
              <details className="mt-2">
                <summary className="text-[10px] text-text-3 cursor-pointer hover:text-text-2">
                  Evaluation log ({section.evaluationLog.length} attempts)
                </summary>
                <div className="mt-1 space-y-1 pl-2">
                  {section.evaluationLog.map((log) => (
                    <div key={log.attempt} className="text-[10px] text-text-3">
                      <span className={log.pass ? 'text-green' : 'text-red'}>
                        {log.pass ? '✓' : '✗'} Attempt {log.attempt + 1}
                      </span>
                      {log.issues.length > 0 && (
                        <ul className="pl-3 mt-0.5 list-disc">
                          {log.issues.map((issue, i) => (
                            <li key={i}>{issue}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-3 flex-wrap">
              {(section.status === 'generated' ||
                section.status === 'needs_review') && (
                <>
                  <button
                    onClick={() => handleApprove(section.sectionId)}
                    className="text-xs bg-green/10 text-green border border-green/40 rounded-lg px-3 py-1 hover:bg-green/20 transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() =>
                      setShowReject((prev) => ({
                        ...prev,
                        [section.sectionId]: !prev[section.sectionId],
                      }))
                    }
                    className="text-xs bg-red/10 text-red border border-red/40 rounded-lg px-3 py-1 hover:bg-red/20 transition-colors"
                  >
                    Reject
                  </button>
                </>
              )}
              {(section.status === 'needs_review' ||
                section.status === 'approved') && (
                <button
                  onClick={() => handleRegenerate(section)}
                  disabled={regenerating[section.sectionId]}
                  className="text-xs bg-accent/10 text-accent border border-accent/40 rounded-lg px-3 py-1 hover:bg-accent/20 transition-colors disabled:opacity-50"
                >
                  {regenerating[section.sectionId]
                    ? 'Regenerating…'
                    : 'Regenerate'}
                </button>
              )}
            </div>

            {/* Reject notes form */}
            {showReject[section.sectionId] && (
              <div className="mt-2 space-y-2">
                <textarea
                  value={rejectNotes[section.sectionId] || ''}
                  onChange={(e) =>
                    setRejectNotes((prev) => ({
                      ...prev,
                      [section.sectionId]: e.target.value,
                    }))
                  }
                  placeholder="Why are you rejecting this section? (optional)"
                  rows={2}
                  className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text placeholder-text-3 focus:border-accent focus:outline-none resize-none"
                />
                <button
                  onClick={() => handleReject(section.sectionId)}
                  className="text-xs bg-red text-white rounded-lg px-3 py-1 hover:bg-red/80 transition-colors"
                >
                  Confirm Reject
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
