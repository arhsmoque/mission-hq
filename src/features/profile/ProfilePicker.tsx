import { useQueryClient } from '@tanstack/react-query';
import { PROFILES, type ProfileId } from './profiles';
import { useRootStore } from '@/stores/rootStore';

export default function ProfilePicker() {
  const setProfile = useRootStore((s) => s.setProfile);
  const queryClient = useQueryClient();

  const handleSelect = (id: ProfileId) => {
    queryClient.clear();
    setProfile(id);
  };

  return (
    <div className="fixed inset-0 bg-bg flex flex-col items-center justify-center p-6 z-50">
      <div className="mb-10 text-center">
        <h1 className="font-display text-3xl font-black text-primary">Mission Room</h1>
        <p className="text-[10px] tracking-[0.25em] uppercase text-text-3 mt-0.5">asmaflahaidar</p>
        <p className="text-sm text-text-2 mt-4">Who's doing missions today?</p>
      </div>

      <div className="w-full max-w-xs space-y-3">
        {PROFILES.map((profile) => (
          <button
            key={profile.id}
            onClick={() => handleSelect(profile.id)}
            style={{ borderColor: `${profile.color}55` }}
            className="w-full rounded-2xl bg-surface border p-5 flex items-center gap-4 active:scale-[0.98] transition-transform"
          >
            <span className="text-3xl leading-none">{profile.emoji}</span>
            <span className="text-xl font-extrabold" style={{ color: profile.color }}>
              {profile.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
