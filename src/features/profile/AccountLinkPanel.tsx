import { useState } from 'react';
import { EmailAuthProvider, linkWithCredential } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useRootStore } from '@/stores/rootStore';

export default function AccountLinkPanel() {
  const setUser    = useRootStore((s) => s.setUser);
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus]     = useState<'idle' | 'saving' | 'ok' | 'err'>('idle');
  const [errMsg, setErrMsg]     = useState('');

  const currentUser = auth.currentUser;
  if (!currentUser?.isAnonymous) {
    return (
      <section className="rounded-2xl bg-bg-2 p-4 border border-border">
        <h3 className="text-sm font-semibold text-text-2 mb-1">Account</h3>
        <p className="text-xs text-text-3">
          Signed in as <span className="font-medium text-text">{currentUser?.email ?? 'permanent account'}</span>.
          Your data is safely stored.
        </p>
      </section>
    );
  }

  async function handleLink() {
    if (!currentUser) return;
    if (!email || !password) { setErrMsg('Enter email and password'); setStatus('err'); return; }
    if (password.length < 6) { setErrMsg('Password must be at least 6 characters'); setStatus('err'); return; }
    setStatus('saving');
    try {
      const credential = EmailAuthProvider.credential(email, password);
      const result = await linkWithCredential(currentUser, credential);
      setUser({
        uid: result.user.uid,
        displayName: result.user.displayName ?? 'Parent',
        avatarUrl: '👨‍👩‍👧‍👦',
      });
      setStatus('ok');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrMsg(
        msg.includes('email-already-in-use')
          ? 'That email is already linked to another account.'
          : msg.includes('invalid-email')
          ? 'Invalid email address.'
          : 'Failed to save account. Try again.'
      );
      setStatus('err');
    }
  }

  if (status === 'ok') {
    return (
      <section className="rounded-2xl bg-green/10 border border-green/30 p-4">
        <p className="text-sm font-bold text-green">Account saved!</p>
        <p className="text-xs text-green/80 mt-1">
          Your data is now linked to {email}. You can sign back in on any device.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-bg-2 p-4 border border-border">
      <h3 className="text-sm font-semibold text-text-2 mb-1">Save Account</h3>
      <p className="text-xs text-text-3 mb-3">
        You're using a temporary session. Link an email to keep your data safe across devices.
      </p>
      <div className="space-y-2">
        <input
          type="email"
          value={email}
          onChange={(e) => { setEmail(e.target.value); setStatus('idle'); }}
          placeholder="Email address"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-3 focus:border-accent focus:outline-none"
        />
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setStatus('idle'); }}
          placeholder="Password (min 6 characters)"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text placeholder-text-3 focus:border-accent focus:outline-none"
        />
        {status === 'err' && <p className="text-xs text-red">{errMsg}</p>}
        <button
          onClick={handleLink}
          disabled={status === 'saving'}
          className="w-full rounded-xl bg-accent py-2 text-sm font-bold text-white disabled:opacity-50 transition-opacity"
        >
          {status === 'saving' ? 'Saving…' : 'Save Account'}
        </button>
      </div>
    </section>
  );
}
