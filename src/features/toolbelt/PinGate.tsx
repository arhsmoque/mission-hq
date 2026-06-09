import { useState, useCallback } from 'react';

const ADMIN_PIN = '240514';

interface PinGateProps {
  onUnlock: () => void;
}

export default function PinGate({ onUnlock }: PinGateProps) {
  const [input, setInput]     = useState('');
  const [shaking, setShaking] = useState(false);

  const press = useCallback((digit: string) => {
    if (shaking) return;
    const next = input + digit;
    if (next.length > 6) return;
    setInput(next);

    if (next.length === 6) {
      if (next === ADMIN_PIN) {
        onUnlock();
      } else {
        setShaking(true);
        setTimeout(() => { setShaking(false); setInput(''); }, 600);
      }
    }
  }, [input, shaking, onUnlock]);

  const backspace = useCallback(() => {
    if (!shaking) setInput((p) => p.slice(0, -1));
  }, [shaking]);

  const numpad = ['1','2','3','4','5','6','7','8','9'];

  return (
    <div className="flex flex-col items-center gap-8 py-6">
      <div>
        <p className="text-center text-sm font-semibold text-text-2 mb-5">
          Admin PIN required
        </p>

        <div className={`flex gap-3 justify-center ${shaking ? 'animate-shake' : ''}`}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                i < input.length
                  ? 'bg-accent border-accent scale-110'
                  : 'bg-transparent border-border'
              }`}
            />
          ))}
        </div>

        {shaking && (
          <p className="text-center text-xs text-red mt-3">Incorrect PIN</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {numpad.map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            className="w-20 h-14 rounded-2xl bg-surface border border-border text-text text-xl font-semibold hover:bg-surface-2 active:scale-95 transition-all"
          >
            {d}
          </button>
        ))}

        <button
          onClick={backspace}
          className="w-20 h-14 rounded-2xl bg-surface border border-border text-text-2 text-sm hover:bg-surface-2 active:scale-95 transition-all"
        >
          ⌫
        </button>
        <button
          onClick={() => press('0')}
          className="w-20 h-14 rounded-2xl bg-surface border border-border text-text text-xl font-semibold hover:bg-surface-2 active:scale-95 transition-all"
        >
          0
        </button>
        <div />
      </div>
    </div>
  );
}
