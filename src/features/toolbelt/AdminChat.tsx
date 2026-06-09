import { useState, useRef, useEffect } from 'react';
import { AVAILABLE_MODELS } from '@/lib/models';
import { useRootStore } from '@/stores/rootStore';
import { waitForLocalCompanionResult } from '@/lib/localCompanionQueue';
import type { AIChatMessage } from '@/ports/ai-port';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  tokens?: { prompt: number; completion: number; total: number };
  latencyMs?: number;
  error?: boolean;
}

type AiRoute = 'api' | 'local_companion';

const ADMIN_DEFAULT_SYSTEM = `You are a curriculum design assistant for a primary school learning app called Mission HQ.
You help the admin (a parent/teacher) design teaching methods, improve lesson prompts, generate content structures, and review pedagogical approaches.
Be direct and thorough. You may give complete answers, solutions, and detailed guidance.`;

const AI_ROUTE_KEY = 'mhq_admin_ai_route';

function loadAiRoute(): AiRoute {
  const saved = localStorage.getItem(AI_ROUTE_KEY);
  return saved === 'local_companion' ? 'local_companion' : 'api';
}

export default function AdminChat() {
  const user          = useRootStore((s) => s.user);
  const adminModel    = useRootStore((s) => s.adminModel);
  const setAdminModel = useRootStore((s) => s.setAdminModel);

  const [messages, setMessages]         = useState<Message[]>([]);
  const [input, setInput]               = useState('');
  const [systemPrompt, setSystemPrompt] = useState(ADMIN_DEFAULT_SYSTEM);
  const [showSystem, setShowSystem]     = useState(false);
  const [temperature, setTemperature]   = useState(0.7);
  const [aiRoute, setAiRouteState]      = useState<AiRoute>(loadAiRoute);
  const [loading, setLoading]           = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  function setAiRoute(next: AiRoute) {
    localStorage.setItem(AI_ROUTE_KEY, next);
    setAiRouteState(next);
  }

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: 'user', content: text };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput('');
    setLoading(true);

    const apiMessages: AIChatMessage[] = [
      ...(systemPrompt.trim()
        ? [{ role: 'system' as const, content: systemPrompt.trim() }]
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

        setMessages([...history, {
          role: 'assistant',
          content: result.text ?? '',
          latencyMs: Date.now() - startTime,
        }]);
        return;
      }

      const res = await fetch('/api/ai/chat', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ messages: apiMessages, model: adminModel, temperature }),
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
        setMessages([...history, {
          role: 'assistant',
          content: data.text ?? '',
          tokens: data.tokens,
          latencyMs,
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
          title="Choose whether this admin chat uses the deployed Gemini API Worker or your desktop Gemini CLI companion."
        >
          <option value="api">Gemini API</option>
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

        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="shrink-0 rounded-xl px-3 py-2 text-xs font-medium border border-border bg-surface text-text-2 hover:text-red hover:border-red transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {aiRoute === 'local_companion' && (
        <div className="mb-3 rounded-xl border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-text-2">
          Local CLI mode writes this chat as a Firebase job. Keep <code>npm run companion:gemini</code> running on your desktop.
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
            <p>{aiRoute === 'local_companion' ? 'Desktop Gemini CLI companion mode.' : 'Direct line to Gemini — no filters.'}</p>
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
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>

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
          placeholder={aiRoute === 'local_companion' ? 'Queue a job for your desktop Gemini CLI…' : 'Ask Gemini anything…'}
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
