import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { resourceDirectory } from '@/adapters';
import { useRootStore } from '@/stores/rootStore';
import { detectSource } from '@/lib/sourceDetector';
import { extractResource, probeResource, type ExtractionProgress } from '@/lib/resourceExtractor';
import { generateLesson, type LessonGenerationProgress } from '@/lib/lessonGenerator';
import { SUBJECTS, SUBJECT_LABELS, SCHOOL_TYPE_LABELS } from '@/types';
import type { ResourceEntry, SchoolType, Subject } from '@/types';
import { PROFILES } from '@/features/profile/profiles';

const SCHOOL_TYPES: SchoolType[] = ['sk', 'srjk_c', 'srjk_t', 'kafa', 'tadika', 'other'];
const YEAR_LEVELS = [1, 2, 3, 4, 5, 6];

const SOURCE_COLORS: Record<string, string> = {
  anyflip:  'text-orange-400 bg-orange-400/10',
  fliphtml5:'text-blue-400 bg-blue-400/10',
  pdf_url:  'text-red bg-red/10',
  website:  'text-text-3 bg-bg-2',
};

const STATUS_COLORS: Record<string, string> = {
  pending:    'text-text-3',
  extracting: 'text-accent',
  ready:      'text-green',
  error:      'text-red',
};

const EMPTY_FORM = {
  url: '', label: '', schoolType: 'srjk_c' as SchoolType,
  subject: 'maths' as Subject, yearLevel: 1, description: '',
};

export default function ResourceDirectory() {
  const navigate = useNavigate();
  const user = useRootStore((s) => s.user);
  const [resources, setResources] = useState<ResourceEntry[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterYear, setFilterYear] = useState<number | 'all'>('all');
  const [error, setError] = useState('');
  const [extracting,    setExtracting]    = useState<Record<string, ExtractionProgress>>({});
  const [extractErrors, setExtractErrors] = useState<Record<string, string>>({});
  // Two-phase extraction: probe → confirm
  const [probing,       setProbing]       = useState<Record<string, boolean>>({});
  const [probedCount,   setProbedCount]   = useState<Record<string, number>>({});     // resourceId → found pages
  const [pageLimit,     setPageLimit]     = useState<Record<string, number | 'all'>>({});
  const [generating,    setGenerating]    = useState<Record<string, LessonGenerationProgress>>({});
  const [genProfile,    setGenProfile]    = useState<Record<string, string>>({}); // resourceId → profileId

  useEffect(() => {
    return resourceDirectory.subscribeResources(setResources);
  }, []);

  const detected = form.url ? detectSource(form.url) : null;

  async function handleAdd() {
    if (!form.url.trim() || !form.label.trim()) {
      setError('URL and label are required.');
      return;
    }
    if (!user) return;
    setError('');
    setSaving(true);
    try {
      await resourceDirectory.addResource({
        url:        form.url.trim(),
        label:      form.label.trim(),
        sourceType: detected?.type ?? 'website',
        schoolType: form.schoolType,
        subject:    form.subject,
        yearLevel:  form.yearLevel,
        description: form.description.trim() || undefined,
        status:     'pending',
        addedBy:    user.uid,
        addedAt:    Date.now(),
      });
      setForm({ ...EMPTY_FORM });
      setAdding(false);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(resourceId: string) {
    await resourceDirectory.deleteResource(resourceId);
  }

  // Phase 1: probe page count, show confirmation panel
  async function handleProbe(resource: ResourceEntry) {
    const id = resource.resourceId;
    setProbing((prev) => ({ ...prev, [id]: true }));
    setExtractErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    try {
      const count = await probeResource(resource);
      if (count === 0) {
        setExtractErrors((prev) => ({ ...prev, [id]: 'Could not find any pages. The book may be private, or the URL format changed. Try opening the book in your browser first.' }));
      } else {
        setProbedCount((prev) => ({ ...prev, [id]: count }));
        setPageLimit((prev) => ({ ...prev, [id]: 'all' }));
      }
    } catch (e) {
      setExtractErrors((prev) => ({ ...prev, [id]: String(e) }));
    } finally {
      setProbing((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  // Phase 2: run actual extraction with the chosen limit
  async function handleExtract(resource: ResourceEntry) {
    const id    = resource.resourceId;
    const limit = pageLimit[id];
    const maxPg = typeof limit === 'number' ? limit : undefined;

    setProbedCount((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setExtractErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setExtracting((prev) => ({ ...prev, [id]: { phase: 'probing' } }));
    try {
      await extractResource(resource, (p) =>
        setExtracting((prev) => ({ ...prev, [id]: p })),
        maxPg,
      );
    } catch (e) {
      setExtractErrors((prev) => ({ ...prev, [id]: String(e) }));
    } finally {
      setExtracting((prev) => { const n = { ...prev }; delete n[id]; return n; });
    }
  }

  function cancelProbe(id: string) {
    setProbedCount((prev) => { const n = { ...prev }; delete n[id]; return n; });
    setExtractErrors((prev) => { const n = { ...prev }; delete n[id]; return n; });
  }

  function progressLabel(p: ExtractionProgress): string {
    if (p.phase === 'probing')        return 'Probing page count…';
    if (p.phase === 'generating_toc') return 'Generating table of contents…';
    if (p.phase === 'saving')         return 'Saving…';
    const done  = p.pagesProcessed ?? 0;
    const total = p.pagesFound ?? '?';
    return `Extracting page ${done} / ${total}…`;
  }

  async function handleGenerate(resource: ResourceEntry) {
    if (!user) return;
    const profileId = genProfile[resource.resourceId] ?? PROFILES[0].id;
    setGenerating((prev) => ({ ...prev, [resource.resourceId]: { phase: 'preparing', sectionsDone: 0, sectionsTotal: 0 } }));
    try {
      await generateLesson({
        resource,
        uid: user.uid,
        profileId,
        onProgress: (p) => setGenerating((prev) => ({ ...prev, [resource.resourceId]: p })),
      });
    } catch {
      // errors bubble to Firebase; clear local state
    } finally {
      setGenerating((prev) => {
        const next = { ...prev };
        delete next[resource.resourceId];
        return next;
      });
    }
  }

  function genProgressLabel(p: LessonGenerationProgress): string {
    if (p.phase === 'preparing') return 'Preparing lesson…';
    if (p.phase === 'done')      return 'Lesson created!';
    const section = p.currentSection ? ` — ${p.currentSection}` : '';
    return `Generating section ${p.sectionsDone + 1} / ${p.sectionsTotal}${section}`;
  }

  const displayed = filterYear === 'all'
    ? resources
    : resources.filter((r) => r.yearLevel === filterYear);

  const byYear = YEAR_LEVELS.reduce<Record<number, ResourceEntry[]>>((acc, y) => {
    acc[y] = displayed.filter((r) => r.yearLevel === y);
    return acc;
  }, {} as Record<number, ResourceEntry[]>);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={() => navigate('/lesson-builder')} className="rounded-xl bg-accent px-4 py-2 font-bold text-white shadow-sm active:scale-95 transition-transform text-sm">
          📚 Manage Lessons
        </button>
      </div>

      {/* Filter + Add button */}
      <div className="flex gap-2 flex-wrap items-center">
        <div className="flex gap-1 flex-wrap flex-1">
          <button
            onClick={() => setFilterYear('all')}
            style={{ minHeight: 'unset', minWidth: 'unset' }}
            className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
              filterYear === 'all' ? 'bg-accent text-bg' : 'bg-bg-2 text-text-2'
            }`}
          >
            All
          </button>
          {YEAR_LEVELS.map((y) => (
            <button
              key={y}
              onClick={() => setFilterYear(y)}
              style={{ minHeight: 'unset', minWidth: 'unset' }}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                filterYear === y ? 'bg-accent text-bg' : 'bg-bg-2 text-text-2'
              }`}
            >
              Tahun {y}
            </button>
          ))}
        </div>

        <button
          onClick={() => setAdding((v) => !v)}
          style={{ minHeight: 'unset', minWidth: 'unset' }}
          className="rounded-xl px-3 py-1.5 text-xs font-semibold bg-surface border border-border text-text-2 hover:text-accent hover:border-accent transition-colors"
        >
          {adding ? 'Cancel' : '+ Add'}
        </button>
      </div>

      {/* Add form */}
      {adding && (
        <div className="rounded-2xl bg-bg-2 border border-border p-4 space-y-3">
          <p className="text-xs font-semibold text-text-2 mb-1">New Resource</p>

          {/* URL */}
          <div>
            <input
              type="url"
              value={form.url}
              onChange={(e) => setForm((f) => ({ ...f, url: e.target.value }))}
              placeholder="https://anyflip.com/… or fliphtml5.com/…"
              className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-3 focus:border-accent focus:outline-none"
              style={{ minHeight: 'unset' }}
            />
            {detected && (
              <p className={`mt-1 text-xs font-medium rounded px-2 py-0.5 inline-block ${SOURCE_COLORS[detected.type]}`}>
                Detected: {detected.label}
              </p>
            )}
          </div>

          {/* Label */}
          <input
            type="text"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Label, e.g. SRJKC Math Tahun 3"
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-3 focus:border-accent focus:outline-none"
            style={{ minHeight: 'unset' }}
          />

          {/* Row: School / Subject / Year */}
          <div className="grid grid-cols-3 gap-2">
            <select
              value={form.schoolType}
              onChange={(e) => setForm((f) => ({ ...f, schoolType: e.target.value as SchoolType }))}
              className="rounded-xl border border-border bg-surface px-2 py-2 text-xs text-text focus:border-accent focus:outline-none"
              style={{ minHeight: 'unset' }}
            >
              {SCHOOL_TYPES.map((s) => (
                <option key={s} value={s}>{SCHOOL_TYPE_LABELS[s]}</option>
              ))}
            </select>

            <select
              value={form.subject}
              onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value as Subject }))}
              className="rounded-xl border border-border bg-surface px-2 py-2 text-xs text-text focus:border-accent focus:outline-none"
              style={{ minHeight: 'unset' }}
            >
              {SUBJECTS.map((s) => (
                <option key={s} value={s}>{SUBJECT_LABELS[s]}</option>
              ))}
            </select>

            <select
              value={form.yearLevel}
              onChange={(e) => setForm((f) => ({ ...f, yearLevel: Number(e.target.value) }))}
              className="rounded-xl border border-border bg-surface px-2 py-2 text-xs text-text focus:border-accent focus:outline-none"
              style={{ minHeight: 'unset' }}
            >
              {YEAR_LEVELS.map((y) => (
                <option key={y} value={y}>Tahun {y}</option>
              ))}
            </select>
          </div>

          {/* Description */}
          <textarea
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            placeholder="Optional description…"
            rows={2}
            className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-xs text-text-2 placeholder-text-3 focus:border-accent focus:outline-none resize-none"
            style={{ minHeight: 'unset' }}
          />

          {error && <p className="text-xs text-red">{error}</p>}

          <button
            onClick={handleAdd}
            disabled={saving}
            className="w-full rounded-xl bg-accent py-2 text-sm font-semibold text-bg disabled:opacity-50 active:scale-95 transition-all"
            style={{ minHeight: 'unset' }}
          >
            {saving ? 'Saving…' : 'Save Resource'}
          </button>
        </div>
      )}

      {/* Resource list grouped by year */}
      {resources.length === 0 && !adding && (
        <p className="text-center text-sm text-text-3 py-6">
          No resources yet. Add flipbook or PDF links to build the directory.
        </p>
      )}

      {YEAR_LEVELS.map((y) => {
        const items = byYear[y];
        if (!items || items.length === 0) return null;
        return (
          <div key={y}>
            <p className="text-xs font-semibold text-text-3 uppercase tracking-wide mb-2">
              Tahun {y}
            </p>
            <div className="space-y-2">
              {items.map((r) => (
                <div
                  key={r.resourceId}
                  className="flex items-start gap-3 rounded-2xl bg-bg-2 border border-border p-3"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-text truncate">{r.label}</span>
                      <span className={`text-xs font-medium rounded px-1.5 py-0.5 ${SOURCE_COLORS[r.sourceType]}`}>
                        {r.sourceType === 'anyflip' ? 'AnyFlip'
                          : r.sourceType === 'fliphtml5' ? 'FlipHTML5'
                          : r.sourceType === 'pdf_url' ? 'PDF'
                          : 'Web'}
                      </span>
                    </div>
                    <p className="text-xs text-text-3 mt-0.5">
                      {SCHOOL_TYPE_LABELS[r.schoolType]} · {SUBJECT_LABELS[r.subject]}
                    </p>
                    {r.description && (
                      <p className="text-xs text-text-2 mt-1">{r.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {extracting[r.resourceId] ? (
                        <span className="text-xs text-accent">
                          ⚡ {progressLabel(extracting[r.resourceId])}
                        </span>
                      ) : (
                        <span className={`text-xs ${STATUS_COLORS[r.status]}`}>
                          {r.status === 'pending' ? '⏳ Pending extraction'
                            : r.status === 'extracting' ? '⚡ Extracting…'
                            : r.status === 'ready' ? `✓ Ready${r.pageCount ? ` · ${r.pageCount} pages` : ''}`
                            : `✗ ${r.errorMessage ?? 'Error'}`}
                        </span>
                      )}
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline"
                        style={{ minHeight: 'unset', minWidth: 'unset' }}
                      >
                        Open ↗
                      </a>
                      {/* Phase 1 trigger — only when not probing/extracting */}
                      {(r.status === 'pending' || r.status === 'error') &&
                        !extracting[r.resourceId] &&
                        !probedCount[r.resourceId] &&
                        !probing[r.resourceId] &&
                        r.sourceType !== 'website' && (
                        <button
                          onClick={() => handleProbe(r)}
                          className="text-xs text-accent border border-accent/40 rounded-lg px-2 py-0.5 hover:bg-accent/10 transition-colors"
                          style={{ minHeight: 'unset', minWidth: 'unset' }}
                        >
                          Extract
                        </button>
                      )}
                      {probing[r.resourceId] && (
                        <span className="text-xs text-text-3">Checking pages…</span>
                      )}
                    </div>

                    {/* Local extraction error */}
                    {extractErrors[r.resourceId] && (
                      <div className="mt-1.5 rounded-lg bg-red/10 border border-red/30 px-2 py-1.5 text-xs text-red">
                        {extractErrors[r.resourceId]}
                        <button
                          onClick={() => cancelProbe(r.resourceId)}
                          className="ml-2 underline"
                          style={{ minHeight: 'unset', minWidth: 'unset' }}
                        >
                          Dismiss
                        </button>
                      </div>
                    )}

                    {/* Phase 2 — page limit confirmation panel */}
                    {probedCount[r.resourceId] != null && !extracting[r.resourceId] && (
                      <div className="mt-2 rounded-xl bg-accent/5 border border-accent/20 p-3 space-y-2 text-xs">
                        <p className="font-semibold text-text">
                          Found {probedCount[r.resourceId]} pages
                          {' · '}
                          <span className="text-text-3 font-normal">
                            ~{Math.ceil((typeof pageLimit[r.resourceId] === 'number' ? pageLimit[r.resourceId] as number : probedCount[r.resourceId]) / 8)} AI calls
                          </span>
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-text-2">Extract up to:</span>
                          {[20, 40, 60, 100].map((n) => (
                            n <= probedCount[r.resourceId] ? (
                              <button
                                key={n}
                                onClick={() => setPageLimit((prev) => ({ ...prev, [r.resourceId]: n }))}
                                className={`rounded-lg px-2 py-0.5 border transition-colors ${
                                  pageLimit[r.resourceId] === n
                                    ? 'bg-accent text-bg border-accent'
                                    : 'border-border text-text-2 hover:border-accent'
                                }`}
                                style={{ minHeight: 'unset', minWidth: 'unset' }}
                              >
                                {n}
                              </button>
                            ) : null
                          ))}
                          <button
                            onClick={() => setPageLimit((prev) => ({ ...prev, [r.resourceId]: 'all' }))}
                            className={`rounded-lg px-2 py-0.5 border transition-colors ${
                              pageLimit[r.resourceId] === 'all'
                                ? 'bg-accent text-bg border-accent'
                                : 'border-border text-text-2 hover:border-accent'
                            }`}
                            style={{ minHeight: 'unset', minWidth: 'unset' }}
                          >
                            All {probedCount[r.resourceId]}
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleExtract(r)}
                            className="rounded-xl bg-accent text-bg px-3 py-1.5 font-semibold text-xs active:scale-95 transition-all"
                            style={{ minHeight: 'unset', minWidth: 'unset' }}
                          >
                            Start Extraction
                          </button>
                          <button
                            onClick={() => cancelProbe(r.resourceId)}
                            className="rounded-xl border border-border text-text-2 px-3 py-1.5 text-xs hover:text-text transition-colors"
                            style={{ minHeight: 'unset', minWidth: 'unset' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {r.status === 'ready' && r.extractedContent?.toc && r.extractedContent.toc.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-xs text-text-3 cursor-pointer hover:text-text-2">
                          Table of contents ({r.extractedContent.toc.length} entries)
                        </summary>
                        <ol className="mt-1 space-y-0.5 pl-3">
                          {r.extractedContent.toc.slice(0, 15).map((entry, i) => (
                            <li
                              key={i}
                              className="text-xs text-text-2"
                              style={{ paddingLeft: `${(entry.level - 1) * 12}px` }}
                            >
                              <span className="text-text-3">p.{entry.pageStart}</span>{' '}
                              {entry.title}
                            </li>
                          ))}
                          {r.extractedContent.toc.length > 15 && (
                            <li className="text-xs text-text-3">…and {r.extractedContent.toc.length - 15} more</li>
                          )}
                        </ol>
                      </details>
                    )}

                    {/* Generate lesson section */}
                    {r.status === 'ready' && r.extractedContent && (
                      generating[r.resourceId] ? (
                        <p className="mt-2 text-xs text-accent">
                          ✦ {genProgressLabel(generating[r.resourceId])}
                        </p>
                      ) : (
                        <div className="mt-2 flex items-center gap-2 flex-wrap">
                          <select
                            value={genProfile[r.resourceId] ?? PROFILES[0].id}
                            onChange={(e) => setGenProfile((prev) => ({ ...prev, [r.resourceId]: e.target.value }))}
                            className="rounded-lg border border-border bg-surface px-2 py-0.5 text-xs text-text focus:border-accent focus:outline-none"
                            style={{ minHeight: 'unset' }}
                          >
                            {PROFILES.map((p) => (
                              <option key={p.id} value={p.id}>{p.emoji} {p.name}</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleGenerate(r)}
                            className="text-xs text-green border border-green/40 rounded-lg px-2 py-0.5 hover:bg-green/10 transition-colors"
                            style={{ minHeight: 'unset', minWidth: 'unset' }}
                          >
                            Generate Lesson
                          </button>
                        </div>
                      )
                    )}
                  </div>

                  <button
                    onClick={() => handleDelete(r.resourceId)}
                    className="text-text-3 hover:text-red transition-colors text-xs shrink-0"
                    style={{ minHeight: 'unset', minWidth: 'unset' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
