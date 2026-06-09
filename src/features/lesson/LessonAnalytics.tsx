import { useState, useEffect } from 'react';
import { useRootStore } from '@/stores/rootStore';
import { analyticsAdapter } from '@/adapters';
import type { AnalyticsSession } from '@/types';

export default function LessonAnalytics() {
  const user = useRootStore(s => s.user);
  const [sessions, setSessions] = useState<AnalyticsSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;
    analyticsAdapter.getRecentSessions(user.uid, 50).then(data => {
      setSessions(data);
      setLoading(false);
    }).catch(err => {
      console.error(err);
      setLoading(false);
    });
  }, [user?.uid]);

  if (loading) return <div className="p-6">Loading analytics...</div>;

  return (
    <div className="p-6 space-y-6">
      <h2 className="font-display text-2xl font-black text-primary">📊 Recent Sessions</h2>
      
      {sessions.length === 0 ? (
        <div className="text-text-2 bg-surface p-6 rounded-2xl">No analytics data yet.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {sessions.map(s => (
            <div key={s.sessionId} className="bg-surface border border-surface-border p-4 rounded-2xl shadow-sm">
              <div className="font-bold text-text-1 truncate">{s.subject} - {s.sectionId}</div>
              <div className="text-sm text-text-2 mt-1">Method: {s.methodId}</div>
              <div className="flex justify-between items-center mt-4 text-sm font-medium">
                <span className={s.successIndicator ? 'text-green' : 'text-text-3'}>
                  {s.successIndicator ? '✅ Completed' : 'In Progress'}
                </span>
                <span className="bg-background px-2 py-1 rounded text-text-2">Hints: {s.hintsRequested}</span>
              </div>
              <div className="text-xs text-text-3 mt-3">
                {new Date(s.startedAt).toLocaleString()} 
                {s.timeToCompleteMs ? ' • ' + Math.round(s.timeToCompleteMs / 1000) + 's' : ''}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
