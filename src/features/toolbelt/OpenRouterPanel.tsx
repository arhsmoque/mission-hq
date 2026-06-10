/**
 * OpenRouterPanel — admin settings panel for OpenRouter integration.
 *
 * Sections:
 *   1. AI Provider toggle (Gemini / OpenRouter)
 *   2. OpenRouter model picker with tier + modality filters
 *   3. Credit balance + topup link
 *   4. Last-call token usage
 *   5. Error log console with copy-to-clipboard
 */

import { useState, useEffect } from 'react';
import { useRootStore } from '@/stores/rootStore';
import {
  useOpenRouterModels,
  isFree,
  isVision,
  type TierFilter,
  type ModalityFilter,
} from '@/lib/useOpenRouterModels';

// ── Balance ────────────────────────────────────────────────────────────────

interface BalanceData {
  label:        string;
  usage:        number;
  limit:        number | null;
  is_free_tier: boolean;
}

function useBalance(enabled: boolean) {
  const [data,    setData]    = useState<BalanceData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  async function fetch_() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/openrouter/balance');
      const json = await res.json() as { data?: BalanceData; error?: string };
      if (!res.ok || json.error) throw new Error(json.error ?? `HTTP ${res.status}`);
      setData(json.data ?? null);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (enabled) fetch_(); }, [enabled]);  // eslint-disable-line react-hooks/exhaustive-deps

  return { data, loading, error, refetch: fetch_ };
}

// ── Provider toggle ────────────────────────────────────────────────────────

function ProviderToggle() {
  const aiProvider    = useRootStore((s) => s.aiProvider);
  const setAiProvider = useRootStore((s) => s.setAiProvider);

  return (
    <div className="flex gap-2">
      {(['gemini', 'openrouter'] as const).map((p) => (
        <button
          key={p}
          onClick={() => setAiProvider(p)}
          className={`flex-1 rounded-xl py-2 text-sm font-semibold transition-colors border ${
            aiProvider === p
              ? 'bg-accent text-bg border-accent'
              : 'bg-surface text-text-2 border-border hover:text-text'
          }`}
          style={{ minHeight: 'unset', minWidth: 'unset' }}
        >
          {p === 'gemini' ? 'Gemini Direct' : 'OpenRouter'}
        </button>
      ))}
    </div>
  );
}

// ── Model picker ───────────────────────────────────────────────────────────

function ModelPicker() {
  const openrouterModel    = useRootStore((s) => s.openrouterModel);
  const setOpenrouterModel = useRootStore((s) => s.setOpenrouterModel);

  const [tier,     setTier]     = useState<TierFilter>('all');
  const [modality, setModality] = useState<ModalityFilter>('all');

  const { models, allCount, loading, error, refetch } = useOpenRouterModels(tier, modality);

  const current = models.find((m) => m.id === openrouterModel) ?? null;
  // If current model is not in filtered list, keep it selectable
  const selectedInList = models.some((m) => m.id === openrouterModel);

  return (
    <div className="space-y-2">
      {/* Filter row */}
      <div className="flex gap-2 flex-wrap">
        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(['all', 'free', 'paid'] as TierFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={`px-2.5 py-1.5 font-medium transition-colors capitalize ${
                tier === t ? 'bg-accent text-bg' : 'bg-surface text-text-2 hover:text-text'
              }`}
              style={{ minHeight: 'unset', minWidth: 'unset' }}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-border overflow-hidden text-xs">
          {(['all', 'vision', 'text'] as ModalityFilter[]).map((mod) => (
            <button
              key={mod}
              onClick={() => setModality(mod)}
              className={`px-2.5 py-1.5 font-medium transition-colors capitalize ${
                modality === mod ? 'bg-accent text-bg' : 'bg-surface text-text-2 hover:text-text'
              }`}
              style={{ minHeight: 'unset', minWidth: 'unset' }}
            >
              {mod}
            </button>
          ))}
        </div>

        {error && (
          <button
            onClick={() => refetch()}
            className="ml-auto text-xs text-red hover:underline"
            style={{ minHeight: 'unset', minWidth: 'unset' }}
          >
            Retry
          </button>
        )}
      </div>

      {/* Dropdown */}
      {loading ? (
        <div className="text-xs text-text-3 py-2">Loading models…</div>
      ) : error ? (
        <div className="text-xs text-red py-1">Failed to load models: {error}</div>
      ) : (
        <select
          value={openrouterModel}
          onChange={(e) => setOpenrouterModel(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5 text-sm text-text focus:border-accent focus:outline-none"
        >
          {!selectedInList && (
            <option value={openrouterModel}>{openrouterModel} (current)</option>
          )}
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — {m.id}{isFree(m) ? ' [FREE]' : ''}
            </option>
          ))}
        </select>
      )}

      {/* Current model info */}
      {current && (
        <div className="rounded-xl bg-bg-2 p-3 text-xs text-text-2 space-y-0.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-text">{current.name}</span>
            {isFree(current) && (
              <span className="rounded-full bg-green/20 text-green px-2 py-0.5 text-xs font-medium">FREE</span>
            )}
            {isVision(current) && (
              <span className="rounded-full bg-accent/20 text-accent px-2 py-0.5 text-xs font-medium">VISION</span>
            )}
          </div>
          {current.description && (
            <p className="leading-relaxed line-clamp-2">{current.description}</p>
          )}
          <p className="text-text-3">
            Context: {current.context_length.toLocaleString()} tokens
            {!isFree(current) && current.pricing && (
              <> · ${(parseFloat(current.pricing.prompt) * 1_000_000).toFixed(2)}/M in · ${(parseFloat(current.pricing.completion) * 1_000_000).toFixed(2)}/M out</>
            )}
          </p>
        </div>
      )}

      {!loading && !error && (
        <p className="text-xs text-text-3">
          {models.length} of {allCount} models shown
        </p>
      )}
    </div>
  );
}

// ── Balance ────────────────────────────────────────────────────────────────

function BalancePanel({ enabled }: { enabled: boolean }) {
  const { data, loading, error, refetch } = useBalance(enabled);

  if (!enabled) return null;

  const remaining =
    data?.limit != null ? `$${(data.limit - data.usage).toFixed(4)}` : 'Unlimited';

  return (
    <div className="rounded-xl bg-bg-2 p-3 text-sm space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-2 uppercase tracking-wide">Credit Balance</span>
        <div className="flex items-center gap-2">
          <button
            onClick={refetch}
            disabled={loading}
            className="text-xs text-text-3 hover:text-accent transition-colors disabled:opacity-40"
            style={{ minHeight: 'unset', minWidth: 'unset' }}
          >
            {loading ? '…' : 'Refresh'}
          </button>
          <a
            href="https://openrouter.ai/credits"
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline"
          >
            Top up ↗
          </a>
        </div>
      </div>

      {error ? (
        <p className="text-xs text-red">{error}</p>
      ) : loading ? (
        <p className="text-xs text-text-3">Loading…</p>
      ) : data ? (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-lg bg-surface p-2">
            <p className="text-xs text-text-3">Used</p>
            <p className="font-semibold text-text">${data.usage.toFixed(4)}</p>
          </div>
          <div className="rounded-lg bg-surface p-2">
            <p className="text-xs text-text-3">Limit</p>
            <p className="font-semibold text-text">
              {data.limit != null ? `$${data.limit.toFixed(2)}` : '∞'}
            </p>
          </div>
          <div className="rounded-lg bg-surface p-2">
            <p className="text-xs text-text-3">Remaining</p>
            <p className={`font-semibold ${data.limit != null && data.limit - data.usage < 1 ? 'text-red' : 'text-green'}`}>
              {remaining}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ── Token usage ────────────────────────────────────────────────────────────

function TokenUsagePanel() {
  const usage = useRootStore((s) => s.lastTokenUsage);
  if (!usage) return null;

  return (
    <div className="rounded-xl bg-bg-2 p-3 text-xs text-text-2">
      <span className="font-semibold text-text-2 uppercase tracking-wide mr-2">Last call</span>
      <span>{usage.prompt.toLocaleString()} in</span>
      <span className="text-text-3 mx-1">·</span>
      <span>{usage.completion.toLocaleString()} out</span>
      <span className="text-text-3 mx-1">·</span>
      <span className="text-text">{usage.total.toLocaleString()} total</span>
    </div>
  );
}

// ── Error log ──────────────────────────────────────────────────────────────

function ErrorLogPanel() {
  const errorLog     = useRootStore((s) => s.errorLog);
  const clearErrorLog = useRootStore((s) => s.clearErrorLog);
  const [copied, setCopied] = useState(false);

  async function copyAll() {
    const text = errorLog
      .map((e) => `[${e.ts}] ${e.source} ${e.model} ${e.status ? `HTTP ${e.status} ` : ''}${e.message}${e.latencyMs ? ` (${e.latencyMs}ms)` : ''}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select + copy
    }
  }

  return (
    <div className="rounded-xl bg-bg-2 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-text-2 uppercase tracking-wide">
          Error Log {errorLog.length > 0 && `(${errorLog.length})`}
        </span>
        <div className="flex gap-2">
          {errorLog.length > 0 && (
            <>
              <button
                onClick={copyAll}
                className="text-xs text-text-3 hover:text-accent transition-colors"
                style={{ minHeight: 'unset', minWidth: 'unset' }}
              >
                {copied ? 'Copied!' : 'Copy all'}
              </button>
              <button
                onClick={clearErrorLog}
                className="text-xs text-text-3 hover:text-red transition-colors"
                style={{ minHeight: 'unset', minWidth: 'unset' }}
              >
                Clear
              </button>
            </>
          )}
        </div>
      </div>

      {errorLog.length === 0 ? (
        <p className="text-xs text-text-3 italic">No errors recorded this session.</p>
      ) : (
        <div className="max-h-48 overflow-y-auto space-y-1 font-mono">
          {errorLog.map((e) => (
            <div key={e.id} className="rounded-lg bg-surface px-2 py-1.5 text-xs break-all">
              <span className="text-text-3 select-none">
                {new Date(e.ts).toLocaleTimeString()} [{e.source}]
              </span>
              {' '}
              <span className="text-accent font-medium">{e.model}</span>
              {e.status && <span className="text-red ml-1">HTTP {e.status}</span>}
              {' '}
              <span className="text-red/80">{e.message}</span>
              {e.latencyMs != null && (
                <span className="text-text-3 ml-1">({e.latencyMs}ms)</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Root export ────────────────────────────────────────────────────────────

export default function OpenRouterPanel() {
  const aiProvider = useRootStore((s) => s.aiProvider);
  const isOR       = aiProvider === 'openrouter';

  return (
    <div className="space-y-4">

      {/* Provider toggle */}
      <section className="rounded-2xl bg-bg-2 p-4 border border-border space-y-3">
        <h3 className="text-sm font-semibold text-text-2">AI Provider</h3>
        <ProviderToggle />
        {isOR && (
          <p className="text-xs text-text-3">
            All AI calls (chat, OCR, lesson generation) will route through OpenRouter.
          </p>
        )}
        {!isOR && (
          <p className="text-xs text-text-3">
            Using Gemini API directly via Cloudflare Worker.
          </p>
        )}
      </section>

      {/* OpenRouter settings — only shown when OR is active */}
      {isOR && (
        <>
          <section className="rounded-2xl bg-bg-2 p-4 border border-border space-y-3">
            <h3 className="text-sm font-semibold text-text-2">OpenRouter Model</h3>
            <ModelPicker />
          </section>

          <BalancePanel enabled={isOR} />
          <TokenUsagePanel />
        </>
      )}

      {/* Error log always visible in admin panel */}
      <ErrorLogPanel />
    </div>
  );
}
