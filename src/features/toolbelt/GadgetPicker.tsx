import { GADGETS } from './useToolbelt';
import { useRootStore } from '@/stores/rootStore';

interface GadgetPickerProps {
  completedMissions: number;
}

export default function GadgetPicker({ completedMissions }: GadgetPickerProps) {
  const { activeGadgets, setActiveGadgets, unlockedGadgets } = useRootStore();

  const toggleGadget = (gadgetId: string) => {
    if (activeGadgets.includes(gadgetId)) {
      setActiveGadgets(activeGadgets.filter((g) => g !== gadgetId));
    } else if (activeGadgets.length < 3) {
      setActiveGadgets([...activeGadgets, gadgetId]);
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-3">
        Choose up to 3 gadgets. Unlock more by completing missions!
      </p>
      {GADGETS.map((gadget) => {
        const unlocked = unlockedGadgets.includes(gadget.id) || completedMissions >= gadget.unlockAt;
        const active = activeGadgets.includes(gadget.id);

        return (
          <button
            key={gadget.id}
            onClick={() => unlocked && toggleGadget(gadget.id)}
            disabled={!unlocked}
            className={`w-full rounded-xl p-4 text-left border transition-all ${
              active
                ? 'bg-accent/10 border-accent'
                : unlocked
                ? 'bg-surface border-border'
                : 'bg-bg-2 border-border opacity-50'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="text-2xl">{gadget.icon}</span>
              <div className="flex-1">
                <p className={`font-semibold ${active ? 'text-accent' : 'text-primary'}`}>
                  {gadget.name}
                  {active && <span className="ml-2 text-xs">(Active)</span>}
                </p>
                <p className="text-xs text-text-3">{gadget.description}</p>
                {!unlocked && (
                  <p className="text-xs text-text-3 mt-1">
                    Unlock at {gadget.unlockAt} missions
                  </p>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
