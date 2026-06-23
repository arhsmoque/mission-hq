import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { signInAnonymously } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRootStore } from '@/stores/rootStore';
import { AVAILABLE_MODELS } from '@/lib/models';
import { GADGETS } from '@/features/toolbelt/useToolbelt';
import MissionArchive from '@/features/mission/MissionArchive';
import ProfilePicker from '@/features/profile/ProfilePicker';
import { PROFILES } from '@/features/profile/profiles';
import { loadGamificationOnce } from '@/lib/gamification';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, setUser, selectedModel, earnedBadges, unlockedGadgets, addBadge, unlockGadget, profileId, clearProfile } = useRootStore();
  const queryClient = useQueryClient();
  const [showArchive, setShowArchive] = useState(false);
  const profile = PROFILES.find((p) => p.id === profileId);
  const currentModel = AVAILABLE_MODELS.find((m) => m.id === selectedModel);

  useEffect(() => {
    if (!user) {
      signInAnonymously(auth).then((cred) => {
        setUser({
          uid: cred.user.uid,
          displayName: 'Agent',
          avatarUrl: '🤖',
        });
      });
    }
  }, [user, setUser]);

  useEffect(() => {
    if (!user?.uid || !profileId) return;
    const profileAtLoad = profileId;
    loadGamificationOnce(profileId).then((data) => {
      if (!data) return;
      if (useRootStore.getState().profileId !== profileAtLoad) return;
      data.badges.forEach((b) => {
        if (!earnedBadges.includes(b)) addBadge(b);
      });
      data.gadgets.forEach((g) => {
        if (!unlockedGadgets.includes(g)) unlockGadget(g);
      });
    });
  }, [user?.uid, profileId, addBadge, unlockGadget, earnedBadges, unlockedGadgets]);

  if (!profileId) return <ProfilePicker />;

  return (
    <div className="p-6 max-w-xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl font-black text-primary">Mission Room</h1>
        <p className="text-[10px] tracking-[0.25em] uppercase text-text-3 mt-0.5">asmaflahaidar</p>
        <p className="text-sm text-text-2 mt-2">Turn homework into missions!</p>
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
            <span
              className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-full border-2 text-3xl leading-none"
              style={{ borderColor: profile?.color }}
            >
              {profile?.emoji}
            </span>
            <div className="flex-1">
              <p className="text-lg font-extrabold" style={{ color: profile?.color }}>
                {profile?.name}
              </p>
              <p className="text-sm text-text-3">Ready for your next mission?</p>
            </div>
            <button
              onClick={() => { queryClient.clear(); clearProfile(); }}
              className="rounded-full bg-surface px-3 py-1 text-xs text-text-3 border border-border"
            >
              Switch
            </button>
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
            onClick={() => navigate('/today')}
            className="w-full rounded-2xl bg-primary px-6 py-5 font-bold text-white shadow-lg active:scale-[0.98] text-lg"
          >
            📅 Today's Plan
          </button>

          <button
            onClick={() => navigate('/new-mission')}
            className="w-full rounded-2xl bg-accent px-6 py-4 font-bold text-white shadow-lg active:scale-[0.98]"
          >
            + New Mission
          </button>

          <div className="grid grid-cols-3 gap-3">
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
              <span className="text-2xl">🀄</span>
              <p className="mt-1 text-sm font-semibold">Chinese Lab</p>
            </button>
            <button
              onClick={() => navigate('/lesson-builder')}
              className="rounded-2xl bg-surface p-4 text-center shadow-sm active:scale-[0.98] border border-border"
            >
              <span className="text-2xl">📚</span>
              <p className="mt-1 text-sm font-semibold">My Lessons</p>
            </button>
          </div>

          <button
            onClick={() => navigate('/toolbelt')}
            className="w-full rounded-2xl bg-surface p-4 text-center shadow-sm active:scale-[0.98] border border-border"
          >
            <span className="text-2xl">🧰</span>
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
