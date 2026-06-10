/**
 * Lesson system ports — contracts for method registry, lesson storage, and analytics.
 *
 * To swap storage backend:
 *   1. Create src/adapters/storage/<backend>-lessons-adapter.ts implementing the ports
 *   2. Update src/adapters/index.ts
 *   3. Done — feature code never imports Firebase directly
 *
 * Firebase RTDB data paths:
 *   teachingMethods  →  mission_hq/teachingMethods/{methodId}       (global)
 *   lessons          →  mission_hq/lessons/{uid}/{lessonId}
 *   analytics        →  mission_hq/analytics/sessions/{uid}/{sessionId}
 *   effectiveness    →  mission_hq/analytics/effectiveness/{methodId}/{subject}
 */

import type {
  TeachingMethod,
  Lesson,
  LessonSection,
  AnalyticsSession,
  MethodEffectiveness,
  ResourceEntry,
  Campaign,
  CampaignSession,
  SessionContent,
} from '@/types';

export interface MethodRegistryPort {
  getAllMethods(): Promise<TeachingMethod[]>;
  getMethod(methodId: string): Promise<TeachingMethod | null>;
  createMethod(method: Omit<TeachingMethod, 'createdAt'>): Promise<void>;
  updateMethod(methodId: string, patch: Partial<Omit<TeachingMethod, 'methodId' | 'createdAt'>>): Promise<void>;
  subscribeActiveMethods(onChange: (methods: TeachingMethod[]) => void): () => void;
}

export interface LessonStoragePort {
  createLesson(uid: string, lessonId: string, data: Omit<Lesson, 'lessonId'>): Promise<void>;
  updateLesson(uid: string, lessonId: string, patch: Record<string, unknown>): Promise<void>;
  subscribeLesson(uid: string, lessonId: string, onChange: (lesson: Lesson | null) => void): () => void;
  subscribeAllLessons(uid: string, onChange: (lessons: Lesson[]) => void): () => void;
  updateSection(uid: string, lessonId: string, sectionId: string, patch: Partial<LessonSection>): Promise<void>;
}

export interface ResourceDirectoryPort {
  addResource(resource: Omit<ResourceEntry, 'resourceId'>): Promise<string>;
  updateResource(resourceId: string, patch: Partial<ResourceEntry>): Promise<void>;
  deleteResource(resourceId: string): Promise<void>;
  subscribeResources(onChange: (resources: ResourceEntry[]) => void): () => void;
  getResourcesByYear(yearLevel: number): Promise<ResourceEntry[]>;
}

export interface CampaignStoragePort {
  createCampaign(campaign: Campaign): Promise<void>;
  updateCampaign(campaignId: string, patch: Partial<Campaign>): Promise<void>;
  updateSession(campaignId: string, sessionIdx: number, patch: Partial<CampaignSession>): Promise<void>;
  deleteCampaign(campaignId: string): Promise<void>;
  subscribeActiveCampaigns(profileId: string, onChange: (campaigns: Campaign[]) => void): () => void;
  getCampaignsByProfile(profileId: string): Promise<Campaign[]>;
}

export interface SessionContentPort {
  getSessionContent(campaignId: string, sessionIdx: number): Promise<SessionContent | null>;
  saveSessionContent(content: SessionContent): Promise<void>;
}

export interface AnalyticsPort {
  startSession(session: Omit<AnalyticsSession, 'sessionId' | 'completedAt' | 'timeToCompleteMs'>): Promise<string>;
  completeSession(uid: string, sessionId: string, outcome: {
    chatTurnsUsed: number;
    hintsRequested: number;
    completedWithoutHelp: boolean;
    successIndicator: boolean;
  }): Promise<void>;
  subscribeMethodEffectiveness(
    methodId: string,
    subject: string,
    onChange: (data: MethodEffectiveness | null) => void
  ): () => void;
  getRecentSessions(uid: string, limit: number): Promise<AnalyticsSession[]>;
}
