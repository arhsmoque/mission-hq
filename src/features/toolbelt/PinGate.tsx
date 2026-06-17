import { useState, useCallback } from 'react';
import { auth } from '@/lib/firebase';
import { verifyPin } from '@/lib/pinUtils';

interface PinGateProps {
  onUnlock: () => void;
}

export default function PinGate({ onUnlock }: PinGateProps) {
  const [input, setInput]     = useState('');
  const [shaking, setShaking] = useState(false);
  const [checking, setChecking] = useState(false);

  const press = useCallback(async (digit: string) => {
    if (shaking || checking) return;
    const next = input + digit;
    if (next.length > 6) return;
    setInput(next);

    if (next.length === 6) {
      const uid = auth.currentUser?.uid;
      if (!uid) return;
      setChecking(true);
      const ok = await verifyPin(uid, next);
      setChecking(false);
      if (ok) {
        onUnlock();
      } else {
        setShaking(true);
        setTimeout(() => { setShaking(false); setInput(''); }, 600);
      }
    }
  }, [input, shaking, checking, onUnlock]);

  const backspace = useCallback(() => {
    if (!shaking && !checking) setInput((p) => p.slice(0, -1));
  }, [shaking, checking]);

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

        {checking && (
          <p className="text-center text-xs text-text-3 mt-3">Checking…</p>
        )}
        {shaking && !checking && (
          <p className="text-center text-xs text-red mt-3">Incorrect PIN</p>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        {numpad.map((d) => (
          <button
            key={d}
            onClick={() => press(d)}
            disabled={checking}
            className="w-20 h-14 rounded-2xl bg-surface border border-border text-text text-xl font-semibold hover:bg-surface-2 active:scale-95 transition-all disabled:opacity-50"
          >
            {d}
          </button>
        ))}

        <button
          onClick={backspace}
          disabled={checking}
          className="w-20 h-14 rounded-2xl bg-surface border border-border text-text-2 text-sm hover:bg-surface-2 active:scale-95 transition-all disabled:opacity-50"
        >
          ⌫
        </button>
        <button
          onClick={() => press('0')}
          disabled={checking}
          className="w-20 h-14 rounded-2xl bg-surface border border-border text-text text-xl font-semibold hover:bg-surface-2 active:scale-95 transition-all disabled:opacity-50"
        >
          0
        </button>
        <div />
      </div>
    </div>
  );
}
