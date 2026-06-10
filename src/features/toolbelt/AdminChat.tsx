import { useState, useRef, useEffect } from 'react';
import { AVAILABLE_MODELS } from '@/lib/models';
import { useRootStore } from '@/stores/rootStore';
import { waitForLocalCompanionResult } from '@/lib/localCompanionQueue';
import {
  parseDirectoryActions,
  stripActionFences,
  executeDirectoryAction,
  buildDirectoryContext,
  DIRECTORY_SYSTEM_PROMPT,
} from '@/lib/resourceDirectoryActions';
import {
  parseCampaignActions,
  stripCampaignFences,
  executeCampaignAction,
  buildCampaignContext,
  CAMPAIGN_SYSTEM_PROMPT,
} from '@/lib/campaignActions';
import { resourceDirectory, campaignStorage } from '@/adapters';
import type { AIChatMessage } from '@/ports/ai-port';
import type { DirectoryAction } from '@/lib/resourceDirectoryActions';
import type { CampaignAction } from '@/lib/campaignActions';
import type { ResourceEntry, Campaign } from '@/types';

// ── Types ──────────────────────────────────────────────────────────────────

type ActionStatus = 'pending' | 'executing' | 'done' | 'error';

type AnyAction = DirectoryAction | CampaignAction;

interface ActionEntry {
  action: AnyAction;
  status: ActionStatus;
  result?: string;
}

interface Message {
  role: 'user' | 'assistant';
  content: string;
  tokens?: { prompt: number; completion: number; total: number };
  latencyMs?: number;
  error?: boolean;
  actions?: ActionEntry[];
}

type AiRoute = 'api' | 'openrouter' | 'local_companion';

// ── Constants ──────────────────────────────────────────────────────────────

const ADMIN_DEFAULT_SYSTEM = `You are a curriculum design assistant for a primary school learning app called Mission HQ.
You help the admin (a parent/teacher) design teaching methods, improve lesson prompts, generate content structures, and review pedagogical approaches.
Be direct and thorough. You may give complete answers, solutions, and detailed guidance.`;

const AI_ROUTE_KEY  = 'mhq_admin_ai_route';
const DIR_MODE_KEY  = 'mhq_admin_dir_mode';

function loadAiRoute(): AiRoute {
  const saved = localStorage.getItem(AI_ROUTE_KEY);
  if (saved === 'local_companion') return 'local_companion';
  if (saved === 'openrouter')      return 'openrouter';
  return 'api';
}

// ── Action card ────────────────────────────────────────────────────────────

function ActionCard({
  entry,
  onExecute,
  onDismiss,
}: {
  entry: ActionEntry;
  onExecute: () => void;
  onDismiss: () => void;
}) {
  const { action, status, result } = entry;

  const badgeColor =
    action.action === 'add'             ? 'bg-green/20 text-green border-green/30' :
    action.action === 'edit'            ? 'bg-yellow/20 text-yellow border-yellow/30' :
    action.action === 'create_campaign' ? 'bg-accent/20 text-accent border-accent/30' :
    'bg-red/20 text-red border-red/30';

  const label =
    'label' in action ? (action as { label: string }).label :
    'resourceId' in action ? (action as { resourceId: string }).resourceId :
    'campaignId' in action ? (action as { campaignId: string }).campaignId : '';

  return (
    <div className="mt-2 rounded-xl border border-border bg-bg-2 px-3 py-2 text-xs space-y-1.5">
      <div className="flex items-center gap-2">
        <span className={`rounded-md border px-2 py-0.5 font-mono font-semibold uppercase text-[10px] ${badgeColor}`}>
          {action.action}
        </span>
        <span className="font-medium text-text truncate">{label}</span>
      </div>

      {action.action === 'add' && (
        <div className="text-text-3 space-y-0.5">
          <div className="truncate font-mono">{action.url}</div>
          <div>Yr{action.yearLevel} · {action.subject} · {action.schoolType}</div>
          {action.description && <div className="italic">{action.description}</div>}
        </div>
      )}

      {action.action === 'edit' && (
        <div className="text-text-3 font-mono text-[10px]">
          {JSON.stringify(Object.fromEntries(
            Object.entries(action).filter(([k]) => k !== 'action' && k !== 'resourceId')
          ))}
        </div>
      )}

      {action.action === 'delete' && (
        <div className="text-red/80">ID: {(action as { resourceId: string }).resourceId}</div>
      )}

      {action.action === 'create_campaign' && (
        <div className="text-text-3 space-y-0.5 text-[11px]">
          <div>{action.profileId} · {action.type} · due {action.deadline}</div>
          {action.scopeSectionTitles && <div>{action.scopeSectionTitles.join(', ')}</div>}
          {action.scopePages && <div>Pages {action.scopePages.start}–{action.scopePages.end}</div>}
        </div>
      )}

      {action.action === 'delete_campaign' && (
        <div className="text-red/80 text-[11px]">Campaign ID: {(action as { campaignId: string }).campaignId}</div>
      )}

      {status === 'pending' && (
        <div className="flex gap-2 pt-0.5">
          <button
            onClick={onExecute}
            className="rounded-lg bg-accent px-3 py-1 text-bg font-medium hover:opacity-90 transition-opacity"
          >
            Execute
          </button>
          <button
            onClick={onDismiss}
            className="rounded-lg border border-border px-3 py-1 text-text-2 hover:border-text-2 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}

      {status === 'executing' && (
        <div className="text-text-3 italic">Executing…</div>
      )}

      {status === 'done' && (
        <div className="text-green font-medium">{result}</div>
      )}

      {status === 'error' && (
        <div className="text-red">{result}</div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

export default function AdminChat() {
  const user            = useRootStore((s) => s.user);
  const adminModel      = useRootStore((s) => s.adminModel);
  const setAdminModel   = useRootStore((s) => s.setAdminModel);
  const openrouterModel = useRootStore((s) => s.openrouterModel);

  const [messages, setMessages]         = useState<Message[]>([]);
  const [input, setInput]               = useState('');
  const [systemPrompt, setSystemPrompt] = useState(ADMIN_DEFAULT_SYSTEM);
  const [showSystem, setShowSystem]     = useState(false);
  const [temperature, setTemperature]   = useState(0.7);
  const [aiRoute, setAiRouteState]      = useState<AiRoute>(loadAiRoute);
  const [loading, setLoading]           = useState(false);
  const [directoryMode, setDirectoryModeState] = useState(
    () => localStorage.getItem(DIR_MODE_KEY) === 'true'
  );
  const [resources, setResources]   = useState<ResourceEntry[]>([]);
  const [campaigns, setCampaigns]   = useState<Campaign[]>([]);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Subscribe to resource directory + all campaigns when Dir mode is on
  useEffect(() => {
    if (!directoryMode) { setResources([]); setCampaigns([]); return; }
    const unsubRes = resourceDirectory.subscribeResources(setResources);
    // Load all campaigns (across all profiles) for context
    const loadCampaigns = async () => {
      const profiles = ['asma', 'aflah', 'haidar'];
      const all: Campaign[] = [];
      for (const pid of profiles) {
        const cs = await campaignStorage.getCampaignsByProfile(pid);
        all.push(...cs.filter((c) => c.status === 'active'));
      }
      setCampaigns(all);
    };
    loadCampaigns();
    return unsubRes;
  }, [directoryMode]);

  function setAiRoute(next: AiRoute) {
    localStorage.setItem(AI_ROUTE_KEY, next);
    setAiRouteState(next);
  }

  function setDirectoryMode(next: boolean) {
    localStorage.setItem(DIR_MODE_KEY, String(next));
    setDirectoryModeState(next);
  }

  function updateAction(msgIdx: number, actionIdx: number, patch: Partial<ActionEntry>) {
    setMessages((prev) =>
      prev.map((m, mi) => {
        if (mi !== msgIdx || !m.actions) return m;
        return {
          ...m,
          actions: m.actions.map((a, ai) =>
            ai === actionIdx ? { ...a, ...patch } : a
          ),
        };
      })
    );
  }

  async function handleExecuteAction(msgIdx: number, actionIdx: number, action: AnyAction) {
    updateAction(msgIdx, actionIdx, { status: 'executing' });
    try {
      let result: string;
      if (action.action === 'create_campaign' || action.action === 'delete_campaign') {
        const resource = action.action === 'create_campaign' && action.resourceId
          ? resources.find((r) => r.resourceId === action.resourceId)
          : undefined;
        result = await executeCampaignAction(action, resource);
      } else {
        result = await executeDirectoryAction(action as DirectoryAction, user?.uid ?? 'admin');
      }
      updateAction(msgIdx, actionIdx, { status: 'done', result });
    } catch (err) {
      updateAction(msgIdx, actionIdx, {
        status: 'error',
        result: err instanceof Error ? err.message : String(err),
      });
    }
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);

    // Build system context: base prompt + optional directory + campaign context
    const systemParts: string[] = [];
    if (systemPrompt.trim()) systemParts.push(systemPrompt.trim());
    if (directoryMode) {
      systemParts.push(DIRECTORY_SYSTEM_PROMPT);
      systemParts.push(buildDirectoryContext(resources));
      systemParts.push(CAMPAIGN_SYSTEM_PROMPT);
      systemParts.push(buildCampaignContext(campaigns));
    }

    const apiMessages: AIChatMessage[] = [
      ...(systemParts.length > 0
        ? [{ role: 'system' as const, content: systemParts.join('\n\n---\n\n') }]
        : []),
      ...history.map((m) => ({ role: m.role, content: m.content })),
    ];

    const startTime = Date.now();
    try {
      if (aiRoute === 'local_companion') {
        if (!user?.uid) throw new Error('No signed-in Mission HQ user; cannot create local companion job.');

        const result = await waitForLocalCompanionResult(user.uid, {
          kind: 'admin_chat',
          messages: apiMessages,
          model: adminModel,
          temperature,
          metadata: {
            source: 'toolbelt_admin_chat',
            requestedAt: new Date().toISOString(),
          },
        });

        const responseText = result.text ?? '';
        const actions: AnyAction[] = directoryMode
          ? [...parseDirectoryActions(responseText), ...parseCampaignActions(responseText)]
          : [];
        setMessages([...history, {
          role: 'assistant',
          content: responseText,
          latencyMs: Date.now() - startTime,
          actions: actions.map((a) => ({ action: a, status: 'pending' as ActionStatus })),
        }]);
        return;
      }

      const endpoint = aiRoute === 'openrouter' ? '/api/openrouter/chat' : '/api/ai/chat';
      const model    = aiRoute === 'openrouter' ? openrouterModel : adminModel;

      const res = await fetch(endpoint, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: apiMessages, model, temperature }),
      });

      const latencyMs = Date.now() - startTime;
      const data = await res.json() as {
        text?: string;
        error?: string;
        tokens?: { prompt: number; completion: number; total: number };
      };

      if (!res.ok || data.error) {
        setMessages([...history, {
          role: 'assistant',
          content: data.error ?? `HTTP ${res.status}`,
          latencyMs,
          error: true,
        }]);
      } else {
        const responseText = data.text ?? '';
        const actions: AnyAction[] = directoryMode
          ? [...parseDirectoryActions(responseText), ...parseCampaignActions(responseText)]
          : [];
        setMessages([...history, {
          role: 'assistant',
          content: responseText,
          tokens: data.tokens,
          latencyMs,
          actions: actions.map((a) => ({ action: a, status: 'pending' as ActionStatus })),
        }]);
      }
    } catch (err) {
      setMessages([...history, {
        role: 'assistant',
        content: String(err),
        latencyMs: Date.now() - startTime,
        error: true,
      }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <select
          value={adminModel}
          onChange={(e) => setAdminModel(e.target.value)}
          className="flex-1 min-w-0 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        <select
          value={aiRoute}
          onChange={(e) => setAiRoute(e.target.value as AiRoute)}
          className="rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-accent focus:outline-none"
          title="Choose AI route for admin chat"
        >
          <option value="api">Gemini API</option>
          <option value="openrouter">OpenRouter</option>
          <option value="local_companion">Local CLI</option>
        </select>

        <div className="flex items-center gap-2 text-xs text-text-2 shrink-0">
          <span>Temp</span>
          <input
            type="range"
            min={0} max={1} step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="w-20 accent-accent"
            style={{ minHeight: 'unset', minWidth: 'unset' }}
          />
          <span className="w-7 text-right">{temperature.toFixed(2)}</span>
        </div>

        <button
          onClick={() => setShowSystem((s) => !s)}
          className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium border transition-colors ${
            showSystem
              ? 'bg-accent/20 border-accent text-accent'
              : 'bg-surface border-border text-text-2'
          }`}
        >
          System
        </button>

        <button
          onClick={() => setDirectoryMode(!directoryMode)}
          title="Directory mode — AI can add/edit/delete resources"
          className={`shrink-0 rounded-xl px-3 py-2 text-xs font-medium border transition-colors ${
            directoryMode
              ? 'bg-green/20 border-green/50 text-green'
              : 'bg-surface border-border text-text-2'
          }`}
        >
          Dir {directoryMode ? `(${resources.length}r ${campaigns.length}c)` : ''}
        </button>

        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="shrink-0 rounded-xl px-3 py-2 text-xs font-medium border border-border bg-surface text-text-2 hover:text-red hover:border-red transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Info banners */}
      {aiRoute === 'openrouter' && (
        <div className="mb-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-text-2">
          OpenRouter mode — using <code className="font-mono">{openrouterModel}</code>. Configure in Settings → OpenRouter.
        </div>
      )}
      {aiRoute === 'local_companion' && (
        <div className="mb-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-text-2">
          Local CLI mode writes this chat as a Firebase job. Keep <code>npm run companion:gemini</code> running on your desktop.
        </div>
      )}
      {directoryMode && (
        <div className="mb-3 rounded-xl border border-green/30 bg-green/10 px-3 py-2 text-xs text-text-2">
          Directory mode — AI can manage resources and create/delete campaigns. All actions require your confirmation.
          {campaigns.length > 0 && ` ${campaigns.length} active campaign(s) loaded.`}
        </div>
      )}

      {/* System prompt */}
      {showSystem && (
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          rows={4}
          placeholder="System prompt (optional — leave blank for no system message)"
          className="mb-3 w-full rounded-xl border border-border bg-bg-2 px-3 py-2 text-xs text-text-2 focus:border-accent focus:outline-none resize-none"
          style={{ minHeight: 'unset' }}
        />
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pr-1">
        {messages.length === 0 && (
          <div className="text-center text-sm text-text-3 pt-8">
            <p className="text-2xl mb-2">⚡</p>
            <p>{
              aiRoute === 'local_companion' ? 'Desktop Gemini CLI companion mode.' :
              aiRoute === 'openrouter'      ? `OpenRouter — ${openrouterModel}` :
              'Direct line to Gemini — no filters.'
            }</p>
            {directoryMode && (
              <p className="mt-1 text-xs text-green">Directory mode active — {resources.length} resources loaded</p>
            )}
            <p className="mt-1 text-xs">⌘↵ or Ctrl↵ to send</p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'bg-accent text-bg rounded-br-sm'
                : msg.error
                ? 'bg-red/10 border border-red/30 text-red rounded-bl-sm'
                : 'bg-surface border border-border text-text rounded-bl-sm'
            }`}>
              {/* Strip all action fences from display text */}
              <p className="whitespace-pre-wrap leading-relaxed">
                {msg.role === 'assistant' && msg.actions?.length
                  ? stripCampaignFences(stripActionFences(msg.content))
                  : msg.content}
              </p>

              {/* Action confirmation cards */}
              {msg.role === 'assistant' && msg.actions && msg.actions.length > 0 && (
                <div className="space-y-2">
                  {msg.actions.map((entry, ai) => (
                    <ActionCard
                      key={ai}
                      entry={entry}
                      onExecute={() => handleExecuteAction(i, ai, entry.action)}
                      onDismiss={() => updateAction(i, ai, { status: 'error', result: 'Dismissed' })}
                    />
                  ))}
                </div>
              )}

              {msg.role === 'assistant' && !msg.error && (
                <div className="flex gap-3 mt-2 text-xs text-text-3">
                  {msg.latencyMs != null && (
                    <span>{(msg.latencyMs / 1000).toFixed(1)}s</span>
                  )}
                  {msg.tokens && (
                    <span>
                      {msg.tokens.prompt}↑ {msg.tokens.completion}↓ ({msg.tokens.total} total)
                    </span>
                  )}
                  {aiRoute === 'local_companion' && <span>local CLI</span>}
                  {aiRoute === 'openrouter' && <span>OpenRouter</span>}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-surface border border-border rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                {[0, 150, 300].map((delay) => (
                  <div
                    key={delay}
                    className="w-2 h-2 rounded-full bg-text-3 animate-bounce"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="mt-3 flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder={
            directoryMode             ? 'Ask to add/edit/delete a resource, or paste an AnyFlip URL…' :
            aiRoute === 'local_companion' ? 'Queue a job for your desktop Gemini CLI…' :
            aiRoute === 'openrouter'      ? `Ask via OpenRouter (${openrouterModel})…` :
            'Ask Gemini anything…'
          }
          rows={2}
          disabled={loading}
          className="flex-1 rounded-2xl border border-border bg-surface px-4 py-3 text-sm text-text placeholder-text-3 focus:border-accent focus:outline-none resize-none disabled:opacity-50"
          style={{ minHeight: 'unset' }}
        />
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="h-12 w-12 rounded-2xl bg-accent text-bg font-bold text-lg flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all shrink-0"
          style={{ minHeight: 'unset', minWidth: 'unset' }}
        >
          ↑
        </button>
      </div>
    </div>
  );
}
