import { useState, useRef, useEffect } from 'react';
import { useChatMessages, useSendMessage } from './useChat';
import { useRootStore } from '@/stores/rootStore';
import { getGadgetContext } from '@/features/toolbelt/useToolbelt';

interface ModuleChatProps {
  missionId: string;
  moduleId?: number;
  moduleTitle?: string;
  ocrText: string;
  onClose: () => void;
}

export default function ModuleChat({ missionId, moduleId, moduleTitle, ocrText, onClose }: ModuleChatProps) {
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const selectedModel = useRootStore((s) => s.selectedModel);
  const activeGadgets = useRootStore((s) => s.activeGadgets);

  const { data: messages = [], isLoading } = useChatMessages(missionId);
  const sendMessage = useSendMessage();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sendMessage.isPending) return;
    const text = input.trim();
    setInput('');

    // Build gadget context from active gadgets
    const gadgetContext = activeGadgets
      .map((id) => getGadgetContext(id))
      .filter(Boolean)
      .join('\n\n');

    await sendMessage.mutateAsync({
      missionId,
      moduleId,
      moduleTitle,
      content: text,
      model: selectedModel,
      ocrText,
      gadgetContext,
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
