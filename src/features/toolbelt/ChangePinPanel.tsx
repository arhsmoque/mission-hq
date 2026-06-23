import { useState } from 'react';
import { auth } from '@/lib/firebase';
import { verifyPin, changePinHash } from '@/lib/pinUtils';

export default function ChangePinPanel() {
  const [current, setCurrent] = useState('');
  const [next, setNext]       = useState('');
  const [confirm, setConfirm] = useState('');
  const [status, setStatus]   = useState<'idle' | 'saving' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg]   = useState('');

  async function handleSave() {
    const uid = auth.currentUser?.uid;
    if (!uid) return;
    if (next.length < 4) { setErrMsg('PIN must be at least 4 digits'); setStatus('err'); return; }
    if (next !== confirm) { setErrMsg('PINs do not match'); setStatus('err'); return; }
    setStatus('saving');
    const ok = await verifyPin(uid, current);
    if (!ok) { setErrMsg('Current PIN is incorrect'); setStatus('err'); return; }
    await changePinHash(uid, next);
    setCurrent(''); setNext(''); setConfirm('');
    setStatus('ok');
    setTimeout(() => setStatus('idle'), 3000);
  }

  return (
    <section className="rounded-2xl bg-bg-2 p-4 border border-border">
      <h3 className="text-sm font-semibold text-text-2 mb-3">Change PIN</h3>
      <div className="space-y-2">
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={current}
          onChange={(e) => { setCurrent(e.target.value.replace(/\D/g, '')); setStatus('idle'); }}
          placeholder="Current PIN"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-3 focus:border-accent focus:outline-none"
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={next}
          onChange={(e) => { setNext(e.target.value.replace(/\D/g, '')); setStatus('idle'); }}
          placeholder="New PIN (4–8 digits)"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-3 focus:border-accent focus:outline-none"
        />
        <input
          type="password"
          inputMode="numeric"
          maxLength={8}
          value={confirm}
          onChange={(e) => { setConfirm(e.target.value.replace(/\D/g, '')); setStatus('idle'); }}
          placeholder="Confirm new PIN"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-3 focus:border-accent focus:outline-none"
        />
        {status === 'err' && <p className="text-xs text-red">{errMsg}</p>}
        {status === 'ok' && <p className="text-xs text-green">PIN updated!</p>}
        <button
          onClick={handleSave}
          disabled={status === 'saving' || !current || !next || !confirm}
          className="w-full rounded-xl bg-accent py-2 text-sm font-bold text-white disabled:opacity-50 transition-opacity"
        >
          {status === 'saving' ? 'Saving…' : 'Update PIN'}
        </button>
      </div>
    </section>
  );
}
