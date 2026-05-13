export interface User {
  uid: string;
  displayName: string;
  avatarUrl: string;
  role: 'child' | 'parent';
  linkedChildUid?: string;
  toolConfig: {
    assistantName: string;
    assistantPersonality: 'encourager' | 'step_by_step' | 'socratic';
    activeGadgets: string[];
    unlockedGadgets: string[];
  };
  earnedBadges: Array<{
    badgeId: string;
    awardedAt: number;
    missionId: string;
  }>;
  dailyMissionLimit: number;
  preferredLanguageOrder: ('ms' | 'en' | 'zh')[];
  createdAt: number;
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
  uid: string;
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
