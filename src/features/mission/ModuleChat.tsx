import { useState, useRef, useEffect } from 'react';
import { useChatMessages, useSendMessage } from './useChat';
import { useRootStore } from '@/stores/rootStore';
import { getGadgetContext } from '@/features/toolbelt/useToolbelt';
import PinGate from '@/features/toolbelt/PinGate';
import {
  applyRapidAttemptBlock,
  buildPolicyContext,
  classifyTutorIntent,
  getResponseMode,
  getRevealEligibility,
  recordWrongAttempt,
  type AttemptPolicyState,
  type TutorResponseMode,
} from './tutoringPolicy';

interface ModuleChatProps {
  missionId: string;
  moduleId?: number;
  moduleTitle?: string;
  moduleGoal?: string;
  ocrText: string;
  onClose: () => void;
}

export default function ModuleChat({ missionId, moduleId, moduleTitle, moduleGoal, ocrText, onClose }: ModuleChatProps) {
  const [input, setInput] = useState('');
  const [attemptState, setAttemptState] = useState<AttemptPolicyState>({ wrongAttemptTimestamps: [] });
  const [showPinGate, setShowPinGate] = useState(false);
  const [policyNotice, setPolicyNotice] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedModel = useRootStore((s) => s.selectedModel);
  const activeGadgets = useRootStore((s) => s.activeGadgets);

  const { data: messages = [], isLoading } = useChatMessages(missionId);
  const sendMessage = useSendMessage();
  const policyKey = `mhq_tutor_policy_${missionId}_${moduleId ?? 'mission'}`;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(policyKey);
      if (raw) setAttemptState(JSON.parse(raw) as AttemptPolicyState);
    } catch {
      setAttemptState({ wrongAttemptTimestamps: [] });
    }
  }, [policyKey]);

  const saveAttemptState = (next: AttemptPolicyState) => {
    setAttemptState(next);
    try {
      localStorage.setItem(policyKey, JSON.stringify(next));
    } catch {}
  };

  const sendWithPolicy = async (text: string, options?: {
    mode?: TutorResponseMode;
    revealAuthorized?: boolean;
    rapidAttemptBlocked?: boolean;
    wrongAttempts?: number;
  }) => {
    if (!text.trim() || sendMessage.isPending) return;

    // Build gadget context from active gadgets
    const gadgetContext = activeGadgets
      .map((id) => getGadgetContext(id))
      .filter(Boolean)
      .join('\n\n');

    await sendMessage.mutateAsync({
      missionId,
      moduleId,
      moduleTitle,
      moduleGoal,
      content: text.trim(),
      model: selectedModel,
      ocrText,
      gadgetContext,
      revealAuthorized: options?.revealAuthorized,
      tutoringPolicyContext: buildPolicyContext({
        mode: options?.mode ?? 'light_hint',
        wrongAttempts: options?.wrongAttempts ?? attemptState.wrongAttemptTimestamps.length,
        revealAuthorized: Boolean(options?.revealAuthorized),
        rapidAttemptBlocked: Boolean(options?.rapidAttemptBlocked),
      }),
    });
  };

  const handleSend = async () => {
    if (!input.trim() || sendMessage.isPending) return;
    const text = input.trim();
    const intent = classifyTutorIntent(text);
    let nextState = attemptState;
    let mode = getResponseMode(intent, attemptState.wrongAttemptTimestamps.length);
    let rapidAttemptBlocked = false;

    setInput('');

    if (intent === 'wrong_attempt') {
      nextState = recordWrongAttempt(attemptState);
      const eligibility = getRevealEligibility(nextState);
      mode = eligibility.mode;
      if (eligibility.mode === 'blocked_rapid_attempts') {
        nextState = applyRapidAttemptBlock();
        rapidAttemptBlocked = true;
        setPolicyNotice('Answer reveal is locked for a short while because the wrong attempts were too fast. Try explaining one step slowly first.');
      } else {
        setPolicyNotice(
          eligibility.canReveal
            ? 'A parent can unlock answer reveal now, but the tutor will still explain the reasoning.'
            : `${eligibility.attemptsRemaining} more careful try needed before parent answer reveal is available.`
        );
      }
      saveAttemptState(nextState);
    }

    await sendWithPolicy(text, {
      mode,
      rapidAttemptBlocked,
      wrongAttempts: nextState.wrongAttemptTimestamps.length,
    });
  };

  const markWrongAttempt = async () => {
    if (sendMessage.isPending) return;
    const nextState = recordWrongAttempt(attemptState);
    const eligibility = getRevealEligibility(nextState);

    if (eligibility.mode === 'blocked_rapid_attempts') {
      const blocked = applyRapidAttemptBlock();
      saveAttemptState(blocked);
      setPolicyNotice('Reveal is locked for a short while because the attempts were too fast. Slow down and explain one step.');
      await sendWithPolicy('My answer was wrong, but I may be rushing. Please slow me down and help me explain one step.', {
        mode: 'blocked_rapid_attempts',
        rapidAttemptBlocked: true,
        wrongAttempts: blocked.wrongAttemptTimestamps.length,
      });
      return;
    }

    saveAttemptState(nextState);
    setPolicyNotice(
      eligibility.canReveal
        ? 'Parent PIN can now unlock answer reveal.'
        : `${eligibility.attemptsRemaining} more careful try needed before parent answer reveal is available.`
    );
    await sendWithPolicy('My answer was wrong. Please help me with the next hint, but do not give the final answer.', {
      mode: eligibility.mode,
      wrongAttempts: nextState.wrongAttemptTimestamps.length,
    });
  };

  const revealEligibility = getRevealEligibility(attemptState);

  const handleRevealWithParent = async () => {
    setShowPinGate(false);
    setPolicyNotice('Parent approved answer reveal. The tutor will explain, then ask for a similar retry.');
    await sendWithPolicy('Parent approved: reveal the answer with reasoning, then give me one similar retry question.', {
      mode: 'reveal_with_parent_pin',
      revealAuthorized: true,
      wrongAttempts: attemptState.wrongAttemptTimestamps.length,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-3">
        <div>
          <h3 className="font-semibold text-primary">
            {moduleTitle ? `Help: ${moduleTitle}` : 'Mission Chat'}
          </h3>
          <p className="text-xs text-text-3">Ask anything about this mission</p>
        </div>
        <button
          onClick={onClose}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-bg-2 text-text-2"
        >
          ✕
        </button>
      </div>

      {/* Active Gadgets */}
      {activeGadgets.length > 0 && (
        <div className="flex gap-2 px-4 py-2 bg-bg-2 overflow-x-auto">
          {activeGadgets.map((id) => (
            <span key={id} className="rounded-full bg-accent/10 px-2 py-1 text-[10px] text-accent font-bold whitespace-nowrap">
              {id.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {policyNotice && (
          <div className="rounded-xl border border-border bg-bg-2 px-3 py-2 text-xs text-text-2">
            {policyNotice}
          </div>
        )}

        {showPinGate && (
          <div className="rounded-2xl border border-border bg-surface p-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-semibold text-primary">Parent approval</p>
              <button className="text-xs text-text-3" onClick={() => setShowPinGate(false)}>Cancel</button>
            </div>
            <p className="text-xs text-text-3">
              Unlock answer reveal after three careful attempts. The tutor will still explain the method.
            </p>
            <PinGate onUnlock={handleRevealWithParent} />
          </div>
        )}

        {isLoading && messages.length === 0 && (
          <div className="text-center text-text-3">Loading messages...</div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.msgId}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                msg.role === 'user'
                  ? 'bg-accent text-white'
                  : 'bg-surface text-text border border-border'
              }`}
            >
              {msg.content}
              {msg.modelUsed && msg.role === 'assistant' && (
                <div className="mt-1 text-[10px] opacity-60">{msg.modelUsed}</div>
              )}
            </div>
          </div>
        ))}

        {sendMessage.isPending && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-surface px-4 py-3 text-sm text-text-3 border border-border">
              <div className="flex items-center gap-2">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
                Thinking...
              </div>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border bg-surface p-3">
        {sendMessage.isError && (
          <p className="mb-2 text-xs text-red-500 text-center">Message failed to send. Please try again.</p>
        )}
        <div className="mb-2 flex gap-2 overflow-x-auto">
          <button
            type="button"
            onClick={markWrongAttempt}
            disabled={sendMessage.isPending || revealEligibility.mode === 'blocked_rapid_attempts'}
            className="rounded-full bg-bg-2 px-3 py-2 text-xs font-semibold text-text-2 disabled:opacity-50"
          >
            My answer was wrong ({revealEligibility.attempts}/3)
          </button>
          <button
            type="button"
            onClick={() => setShowPinGate(true)}
            disabled={!revealEligibility.canReveal || sendMessage.isPending}
            className="rounded-full bg-accent px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
          >
            Parent reveal
          </button>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask a question..."
            className="flex-1 rounded-xl border border-border bg-bg px-4 py-3 text-sm text-text focus:border-accent focus:outline-none"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
            className="rounded-xl bg-accent px-5 py-3 font-bold text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
