import { create } from 'zustand';
import { DEFAULT_MODEL_ID } from '@/lib/models';

interface AuthSlice {
  user: { uid: string; displayName: string; avatarUrl: string } | null;
  setUser: (user: AuthSlice['user']) => void;
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

export const useRootStore = create<
  AuthSlice & MissionUISlice & ToolbeltSlice & GamificationSlice
>((set, get) => ({
  // Auth slice
  user: null,
  setUser: (user) => set({ user }),

  // Mission UI slice
  activeMissionId: null,
  activeModuleId: null,
  chatOpen: false,
  setActiveMissionId: (id) => set({ activeMissionId: id }),
  setActiveModuleId: (id) => set({ activeModuleId: id }),
  setChatOpen: (open) => set({ chatOpen: open }),

  // Toolbelt slice
  activeGadgets: ['hint_machine'],
  setActiveGadgets: (gadgets) => set({ activeGadgets: gadgets }),
  selectedModel: DEFAULT_MODEL_ID,
  setSelectedModel: (model) => set({ selectedModel: model }),

  // Gamification slice
  earnedBadges: [],
  unlockedGadgets: ['hint_machine'],
  addBadge: (badge) => {
    const current = get().earnedBadges;
    if (!current.includes(badge)) {
      set({ earnedBadges: [...current, badge] });
    }
  },
  unlockGadget: (gadget) => {
    const current = get().unlockedGadgets;
    if (!current.includes(gadget)) {
      set({ unlockedGadgets: [...current, gadget] });
    }
  },
}));
