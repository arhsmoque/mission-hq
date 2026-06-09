import { useState, useEffect } from 'react';
import { resourceDirectory } from '@/adapters';
import { useRootStore } from '@/stores/rootStore';
import { detectSource } from '@/lib/sourceDetector';
import { extractResource, type ExtractionProgress } from '@/lib/resourceExtractor';
import { SUBJECTS, SUBJECT_LABELS, SCHOOL_TYPE_LABELS } from '@/types';
import type { ResourceEntry, SchoolType, Subject } from '@/types';

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
  const user = useRootStore((s) => s.user);
  const [resources, setResources] = useState<ResourceEntry[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterYear, setFilterYear] = useState<number | 'all'>('all');
  const [error, setError] = useState('');
  const [extracting, setExtracting] = useState<Record<string, ExtractionProgress>>({});

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

  async function handleExtract(resource: ResourceEntry) {
    setExtracting((prev) => ({ ...prev, [resource.resourceId]: { phase: 'probing' } }));
    try {
      await extractResource(resource, (p) =>
        setExtracting((prev) => ({ ...prev, [resource.resourceId]: p })),
      );
    } catch {
      // error stored to Firebase by extractResource; clear local progress state
    } finally {
      setExtracting((prev) => {
        const next = { ...prev };
        delete next[resource.resourceId];
        return next;
      });
    }
  }

  function progressLabel(p: ExtractionProgress): string {
    if (p.phase === 'probing')        return 'Probing page count…';
    if (p.phase === 'generating_toc') return 'Generating table of contents…';
    if (p.phase === 'saving')         return 'Saving…';
    const done  = p.pagesProcessed ?? 0;
    const total = p.pagesFound ?? '?';
    return `Extracting page ${done} / ${total}…`;
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
                      {(r.status === 'pending' || r.status === 'error') && !extracting[r.resourceId] && r.sourceType !== 'website' && (
                        <button
                          onClick={() => handleExtract(r)}
                          className="text-xs text-accent border border-accent/40 rounded-lg px-2 py-0.5 hover:bg-accent/10 transition-colors"
                          style={{ minHeight: 'unset', minWidth: 'unset' }}
                        >
                          Extract
                        </button>
                      )}
                    </div>
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
