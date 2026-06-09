import { useState, useEffect } from 'react';
import { useRootStore } from '@/stores/rootStore';
import { lessonStorage } from '@/adapters';
import type { Lesson } from '@/types';

export function useLessons() {
  const user = useRootStore(s => s.user);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setLessons([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = lessonStorage.subscribeAllLessons(user.uid, (data) => {
      setLessons(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid]);

  return { lessons, loading };
}

export function useLesson(lessonId?: string) {
  const user = useRootStore(s => s.user);
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid || !lessonId) {
      setLesson(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = lessonStorage.subscribeLesson(user.uid, lessonId, (data) => {
      setLesson(data);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user?.uid, lessonId]);

  return { lesson, loading };
}
