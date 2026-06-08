import { create } from 'zustand';
import { DEFAULT_MODEL_ID } from '@/lib/models';
import type { ProfileId } from '@/features/profile/profiles';
import type { AuthUser } from '@/types';

interface StoredPrefs {
  earnedBadges: string[];
  unlockedGadgets: string[];
  activeGadgets: string[];
  selectedModel: string;
}

function loadPrefs(profileId: string): Partial<StoredPrefs> {
  try {
    const raw = localStorage.getItem(`mhq_prefs_${profileId}`);
    return raw ? (JSON.parse(raw) as Partial<StoredPrefs>) : {};
  } catch { return {}; }
}

function savePrefs(profileId: string, update: Partial<StoredPrefs>) {
  try {
    localStorage.setItem(
      `mhq_prefs_${profileId}`,
      JSON.stringify({ ...loadPrefs(profileId), ...update })
    );
  } catch {}
}

interface AuthSlice {
  user: AuthUser | null;
  authReady: boolean;
  setUser: (user: AuthUser | null) => void;
  setAuthReady: (ready: boolean) => void;
}

interface MissionUISlice {
  activeMissionId: string | null;
  activeModuleId: number | null;
  chatOpen: boolean;
  setActiveMissionId: (id: string | null) => void;
  setActiveModuleId: (id: number | null) => void;
  setChatOpen: (open: boolean) => void;
}

interface ToolbeltSlice {
  activeGadgets: string[];
  setActiveGadgets: (gadgets: string[]) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
}

interface GamificationSlice {
  earnedBadges: string[];
  unlockedGadgets: string[];
  addBadge: (badge: string) => void;
  unlockGadget: (gadget: string) => void;
}

interface ProfileSlice {
  profileId: ProfileId | null;
  setProfile: (id: ProfileId) => void;
  clearProfile: () => void;
}

const _initProfileId = localStorage.getItem('mission_room_profile') as ProfileId | null;
const _initPrefs = _initProfileId ? loadPrefs(_initProfileId) : {};

export const useRootStore = create<
  AuthSlice & MissionUISlice & ToolbeltSlice & GamificationSlice & ProfileSlice
>((set, get) => ({
  user: null,
  authReady: false,
  setUser: (user) => set({ user }),
  setAuthReady: (ready) => set({ authReady: ready }),

  activeMissionId: null,
  activeModuleId: null,
  chatOpen: false,
  setActiveMissionId: (id) => set({ activeMissionId: id }),
  setActiveModuleId: (id) => set({ activeModuleId: id }),
  setChatOpen: (open) => set({ chatOpen: open }),

  activeGadgets: _initPrefs.activeGadgets ?? ['hint_machine'],
  setActiveGadgets: (gadgets) => {
    const { profileId } = get();
    set({ activeGadgets: gadgets });
    if (profileId) savePrefs(profileId, { activeGadgets: gadgets });
  },
  selectedModel: _initPrefs.selectedModel ?? DEFAULT_MODEL_ID,
  setSelectedModel: (model) => {
    const { profileId } = get();
    set({ selectedModel: model });
    if (profileId) savePrefs(profileId, { selectedModel: model });
  },

  earnedBadges: _initPrefs.earnedBadges ?? [],
  unlockedGadgets: _initPrefs.unlockedGadgets ?? ['hint_machine'],
  addBadge: (badge) => {
    const { earnedBadges, profileId } = get();
    if (!earnedBadges.includes(badge)) {
      const next = [...earnedBadges, badge];
      set({ earnedBadges: next });
      if (profileId) savePrefs(profileId, { earnedBadges: next });
    }
  },
  unlockGadget: (gadget) => {
    const { unlockedGadgets, profileId } = get();
    if (!unlockedGadgets.includes(gadget)) {
      const next = [...unlockedGadgets, gadget];
      set({ unlockedGadgets: next });
      if (profileId) savePrefs(profileId, { unlockedGadgets: next });
    }
  },

  profileId: _initProfileId,
  setProfile: (id) => {
    localStorage.setItem('mission_room_profile', id);
    const prefs = loadPrefs(id);
    set({
      profileId: id,
      earnedBadges:    prefs.earnedBadges    ?? [],
      unlockedGadgets: prefs.unlockedGadgets ?? ['hint_machine'],
      activeGadgets:   prefs.activeGadgets   ?? ['hint_machine'],
      selectedModel:   prefs.selectedModel   ?? DEFAULT_MODEL_ID,
    });
  },
  clearProfile: () => {
    localStorage.removeItem('mission_room_profile');
    set({ profileId: null });
  },
}));
