import { AVAILABLE_MODELS } from '@/lib/models';
import { useRootStore } from '@/stores/rootStore';

export default function ModelPicker() {
  const selectedModel = useRootStore((s) => s.selectedModel);
  const setSelectedModel = useRootStore((s) => s.setSelectedModel);

  const current = AVAILABLE_MODELS.find((m) => m.id === selectedModel);

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-semibold text-text-2 mb-1">
          AI Brain
        </label>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-3 py-3 text-sm text-text focus:border-accent focus:outline-none"
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.id} value={model.id}>
              {model.name} ({model.provider})
            </option>
          ))}
        </select>
      </div>

      {current && (
        <div className="rounded-xl bg-bg-2 p-3 text-xs text-text-2">
          <p className="font-medium text-text">{current.name}</p>
          <p className="mt-0.5">{current.description}</p>
          <p className="mt-1 text-text-3">
            Context window: {current.contextWindow.toLocaleString()} tokens
          </p>
        </div>
      )}
    </div>
  );
}
