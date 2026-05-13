import { useState } from 'react';
import { useRootStore } from '@/stores/rootStore';
import { PERSONALITIES } from './useToolbelt';

const AVATARS = ['🤖', '🦊', '🐼', '🐯', '🐸', '🦄', '🐙', '🐢', '🦉', '🐧'];

export default function AssistantConfig() {
  const { user, setUser } = useRootStore();
  const [name, setName] = useState(user?.displayName || 'Agent');
  const [avatar, setAvatar] = useState(user?.avatarUrl || '🤖');

  const save = () => {
    if (user) {
      setUser({ ...user, displayName: name, avatarUrl: avatar });
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="block text-sm font-semibold text-text-2 mb-2">Assistant Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-border bg-surface px-4 py-3 text-text focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-text-2 mb-2">Avatar</label>
        <div className="flex flex-wrap gap-3">
          {AVATARS.map((emoji) => (
            <button
              key={emoji}
              onClick={() => setAvatar(emoji)}
              className={`text-3xl rounded-xl p-2 border-2 transition-all ${
                avatar === emoji
                  ? 'border-accent bg-accent/10'
                  : 'border-transparent bg-surface'
              }`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-text-2 mb-2">Personality</label>
        <div className="space-y-2">
          {PERSONALITIES.map((p) => (
            <div key={p.id} className="rounded-xl bg-surface p-3 border border-border">
              <p className="font-semibold text-primary">{p.name}</p>
              <p className="text-xs text-text-3">{p.description}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-text-3 mt-2">Personality selection coming in a future update.</p>
      </div>

      <button
        onClick={save}
        className="w-full rounded-xl bg-accent py-3 font-bold text-white"
      >
        Save Changes
      </button>
    </div>
  );
}
