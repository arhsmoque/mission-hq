import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useRootStore } from '@/stores/rootStore';
import PinGate from './PinGate';
import AdminChat from './AdminChat';
import ModelPicker from './ModelPicker';
import OpenRouterPanel from './OpenRouterPanel';
import ResourceDirectory from './ResourceDirectory';
import LocalCompanionStatusPanel from './LocalCompanionStatusPanel';

type AdminTab = 'chat' | 'directory' | 'settings';

export default function AdminPanel() {
  const adminUnlocked = useRootStore((s) => s.adminUnlocked);
  const unlockAdmin   = useRootStore((s) => s.unlockAdmin);
  const lockAdmin     = useRootStore((s) => s.lockAdmin);
  const [tab, setTab] = useState<AdminTab>('chat');
  const navigate      = useNavigate();

  if (!adminUnlocked) {
    return <PinGate onUnlock={unlockAdmin} />;
  }

  return (
    <div className="flex flex-col h-[70vh] min-h-0">

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-2">
          {(['chat', 'directory', 'settings'] as AdminTab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors ${
                tab === t
                  ? 'bg-accent text-bg'
                  : 'bg-bg-2 text-text-2 hover:text-text'
              }`}
              style={{ minHeight: 'unset', minWidth: 'unset' }}
            >
              {t === 'chat' ? 'Chat' : t === 'directory' ? 'Directory' : 'Settings'}
            </button>
          ))}
        </div>

        <button
          onClick={lockAdmin}
          className="text-xs text-text-3 hover:text-red transition-colors"
          style={{ minHeight: 'unset', minWidth: 'unset' }}
        >
          Lock
        </button>
      </div>

      {/* Content */}
      {tab === 'chat' && (
        <div className="flex-1 min-h-0">
          <AdminChat />
        </div>
      )}

      {tab === 'directory' && (
        <div className="flex-1 overflow-y-auto min-h-0">
          <ResourceDirectory />
        </div>
      )}

      {tab === 'settings' && (
        <div className="space-y-4 overflow-y-auto pr-1">
          <button
            onClick={() => navigate('/lesson-builder')}
            className="w-full rounded-2xl bg-accent/10 border border-accent/30 px-4 py-3 text-left text-sm font-semibold text-accent active:scale-[0.98] transition-transform"
            style={{ minHeight: 'unset' }}
          >
            📚 Lesson Builder
          </button>

          <section className="rounded-2xl bg-bg-2 p-4 border border-border">
            <h3 className="text-sm font-semibold text-text-2 mb-3">
              Child AI Brain (Gemini Direct)
            </h3>
            <ModelPicker />
          </section>

          <OpenRouterPanel />

          <section className="rounded-2xl bg-bg-2 p-4 border border-border">
            <h3 className="text-sm font-semibold text-text-2 mb-3">
              Local Gemini Companion
            </h3>
            <LocalCompanionStatusPanel />
          </section>
        </div>
      )}
    </div>
  );
}
