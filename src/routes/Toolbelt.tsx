import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ModelPicker from '@/features/toolbelt/ModelPicker';
import GadgetPicker from '@/features/toolbelt/GadgetPicker';
import AssistantConfig from '@/features/toolbelt/AssistantConfig';

export default function Toolbelt() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'gadgets' | 'assistant' | 'model'>('gadgets');

  return (
    <div className="p-6 max-w-xl mx-auto">
      <button onClick={() => navigate(-1)} className="mb-4 text-text-2">
        Back
      </button>
      <h1 className="font-display text-2xl font-black text-primary mb-6">
        My Toolbelt
      </h1>

      <div className="flex gap-2 mb-6">
        {(['gadgets', 'assistant', 'model'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 rounded-xl py-2 text-sm font-semibold capitalize ${
              tab === t ? 'bg-accent text-white' : 'bg-bg-2 text-text-2'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'gadgets' && (
        <section className="rounded-2xl bg-surface p-5 shadow-sm border border-border">
          <h2 className="font-semibold text-primary mb-3">Gadgets</h2>
          <GadgetPicker completedMissions={0} />
        </section>
      )}

      {tab === 'assistant' && (
        <section className="rounded-2xl bg-surface p-5 shadow-sm border border-border">
          <h2 className="font-semibold text-primary mb-3">My Assistant</h2>
          <AssistantConfig />
        </section>
      )}

      {tab === 'model' && (
        <section className="rounded-2xl bg-surface p-5 shadow-sm border border-border">
          <h2 className="font-semibold text-primary mb-3">AI Brain</h2>
          <ModelPicker />
        </section>
      )}
    </div>
  );
}
