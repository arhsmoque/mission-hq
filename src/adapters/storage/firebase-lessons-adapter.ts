/**
 * Firebase RTDB adapter for PDF-sourced lessons.
 *
 * Lessons are per-user. Sections are stored as a keyed object inside the lesson
 * document so individual section updates are cheap (no full lesson rewrite).
 *
 * Data path: mission_hq/lessons/{uid}/{lessonId}
 */

import { ref, set, update, onValue } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import type { LessonStoragePort } from '@/ports/lesson-port';
import type { Lesson, LessonSection } from '@/types';

const LESSONS_ROOT = 'mission_hq/lessons';

function deserialiseLesson(lessonId: string, raw: Record<string, unknown>): Lesson {
  const sections = raw.sections
    ? Object.entries(raw.sections as Record<string, LessonSection>).map(
        ([, s]) => s
      )
    : [];
  const toc = raw.toc
    ? Object.values(raw.toc as Record<string, unknown>)
    : [];
  return { ...(raw as Omit<Lesson, 'lessonId' | 'sections' | 'toc'>), lessonId, sections, toc } as Lesson;
}

export const firebaseLessonsAdapter: LessonStoragePort = {
  async createLesson(uid, lessonId, data) {
    const sectionsKeyed = Object.fromEntries(
      data.sections.map((s) => [s.sectionId, s])
    );
    const tocKeyed = Object.fromEntries(
      data.toc.map((t) => [t.sectionId, t])
    );
    await set(ref(rtdb, `${LESSONS_ROOT}/${uid}/${lessonId}`), {
      ...data,
      sections: sectionsKeyed,
      toc: tocKeyed,
    });
  },

  async updateLesson(uid, lessonId, patch) {
    await update(ref(rtdb, `${LESSONS_ROOT}/${uid}/${lessonId}`), patch);
  },

  subscribeLesson(uid, lessonId, onChange) {
    const dbRef = ref(rtdb, `${LESSONS_ROOT}/${uid}/${lessonId}`);
    return onValue(dbRef, (snap) => {
      if (!snap.exists()) return onChange(null);
      onChange(deserialiseLesson(lessonId, snap.val() as Record<string, unknown>));
    });
  },

  subscribeAllLessons(uid, onChange) {
    const dbRef = ref(rtdb, `${LESSONS_ROOT}/${uid}`);
    return onValue(dbRef, (snap) => {
      if (!snap.exists()) return onChange([]);
      const lessons = Object.entries(snap.val() as Record<string, Record<string, unknown>>)
        .map(([id, raw]) => deserialiseLesson(id, raw))
        .sort((a, b) => b.createdAt - a.createdAt);
      onChange(lessons);
    });
  },

  async updateSection(uid, lessonId, sectionId, patch) {
    const patchKeyed: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      patchKeyed[`sections/${sectionId}/${k}`] = v;
    }
    await update(ref(rtdb, `${LESSONS_ROOT}/${uid}/${lessonId}`), patchKeyed);
  },
};
