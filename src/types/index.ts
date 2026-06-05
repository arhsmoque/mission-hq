/**
 * Core domain types.
 *
 * AuthUser replaces the previously over-specified User interface.
 * The full parental-control User schema (role, linkedChildUid, toolConfig, etc.)
 * was never wired up — removed to match actual runtime shape.
 *
 * Profiles (Asma / Aflah / Haidar) live in src/features/profile/profiles.ts.
 * Add/remove profiles with:  node scripts/profiles.mjs
 */

export interface AuthUser {
  uid: string;
  displayName: string;
  avatarUrl: string;
}

export interface Module {
  id: number;
  title: string;
  goal: string;
  hint: string;
  example?: string;
  reflectionPrompt: string;
  isComplete: boolean;
  completedAt?: number;
}

export interface Mission {
  missionId: string;
  profileId: string;
  title: string;
  client: string;
  status: 'pending' | 'active' | 'completed' | 'archived';
  fileUrl?: string;
  ocrText: string;
  ocrEngine: 'tesseract' | 'google_vision';
  aiAnalysis: {
    model: string;
    generatedAt: number;
    modules: Module[];
  };
  customModuleOrder?: number[];
  parentReviewed: boolean;
  estimatedDurationMinutes: number;
  completedAt?: number;
  createdAt: number;
}

export interface ChatMessage {
  msgId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  moduleId?: number;
  gadgetUsed?: string;
  modelUsed?: string;
  timestamp: number;
}

export interface VocabEntry {
  vocabId: string;
  character: string;
  pinyin: string;
  malay: string;
  english: string;
  sourceMissionId: string;
  sourceModuleId?: number;
  savedAt: number;
  reviewCount: number;
  nextReview: number;
}
