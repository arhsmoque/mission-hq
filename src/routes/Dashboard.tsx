import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRootStore } from '@/stores/rootStore';
import { AVAILABLE_MODELS } from '@/lib/models';
import { GADGETS } from '@/features/toolbelt/useToolbelt';
import MissionArchive from '@/features/mission/MissionArchive';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, setUser, selectedModel, earnedBadges, unlockedGadgets } = useRootStore();
  const [showArchive, setShowArchive] = useState(false);

  const currentModel = AVAILABLE_MODELS.find((m) => m.id === selectedModel);

  useEffect(() => {
    if (!user) {
      signInAnonymously(auth).then((cred) => {
        setUser({
          uid: cred.user.uid,
          displayName: 'Agent',
          avatarUrl: '\uD83E\uDD16',
        });
      });
    }
  }, [user, setUser]);

  return (
    <div className="p-6 max-w-xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-black text-primary">Mission HQ</h1>
        <p className="text-text-2">Turn homework into missions!</p>
      </header>

      {currentModel && (
        <div className="mb-4 rounded-xl bg-bg-2 px-3 py-2 text-xs text-text-2 inline-flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green" />
          AI Brain: <span className="font-semibold text-text">{currentModel.name}</span>
        </div>
      )}

      {user ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{user.avatarUrl}</span>
            <div>
              <p className="font-semibold">{user.displayName}</p>
              <p className="text-sm text-text-3">Ready for your next mission?</p>
            </div>
          </div>

          {/* Badges */}
          {earnedBadges.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {earnedBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full bg-accent/10 px-3 py-1 text-xs font-bold text-accent"
                >
                  🏆 {badge}
                </span>
              ))}
            </div>
          )}

          {/* Gadgets */}
          {unlockedGadgets.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {unlockedGadgets.map((gId) => {
                const gadget = GADGETS.find((g) => g.id === gId);
                return gadget ? (
                  <span
                    key={gId}
                    className="rounded-full bg-bg-2 px-3 py-1 text-xs text-text-2"
                  >
                    {gadget.icon} {gadget.name}
                  </span>
                ) : null;
              })}
            </div>
          )}

          <button
            onClick={() => navigate('/new-mission')}
            className="w-full rounded-2xl bg-accent px-6 py-4 font-bold text-white shadow-lg active:scale-[0.98]"
          >
            + New Mission
          </button>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setShowArchive(!showArchive)}
              className="rounded-2xl bg-surface p-4 text-center shadow-sm active:scale-[0.98] border border-border"
            >
              <span className="text-2xl">📂</span>
              <p className="mt-1 text-sm font-semibold">
                {showArchive ? 'Hide Archive' : 'My Missions'}
              </p>
            </button>
            <button
              onClick={() => navigate('/chinese-lab')}
              className="rounded-2xl bg-surface p-4 text-center shadow-sm active:scale-[0.98] border border-border"
            >
              <span className="text-2xl">\uD83C\uDC04</span>
              <p className="mt-1 text-sm font-semibold">Chinese Lab</p>
            </button>
          </div>

          <button
            onClick={() => navigate('/toolbelt')}
            className="w-full rounded-2xl bg-surface p-4 text-center shadow-sm active:scale-[0.98] border border-border"
          >
            <span className="text-2xl">\uD83E\uDDF0</span>
            <p className="mt-1 text-sm font-semibold">My Toolbelt</p>
          </button>

          {showArchive && (
            <div className="mt-4">
              <MissionArchive />
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-64 items-center justify-center text-text-3">Getting ready...</div>
      )}
    </div>
  );
}
