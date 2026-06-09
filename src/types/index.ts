/**
 * Core domain types.
 *
 * AuthUser replaces the previously over-specified User interface.
 * The full parental-control User schema (role, linkedChildUid, toolConfig, etc.)
 * was never wired up — removed to match actual runtime shape.
 *
 * Profiles (Asma / Aflah / Haidar) live in src/features/profile/profiles.ts.
 * Add/remove profiles with:  node scripts/profiles.mjs
 *
 * Teaching methodology types (TeachingMethod, Lesson, AnalyticsSession) support
 * the expandable method registry and PDF lesson pipeline introduced in Stage 1.
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
  ocrEngine: 'tesseract' | 'google_vision' | 'vision_llm';
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

// ── Teaching Method Registry ───────────────────────────────────────────────

export type MethodFramework = 'cognitive' | 'inquiry' | 'constructivist' | 'behavioural';

export interface MethodPhase {
  id: string;
  label: string;
  description: string;
  verbExamples: string[];
  activityTypes: string[];
  promptGuidance: string;
}

export interface EvaluationCriteria {
  id: string;
  check: string;
  required: boolean;
}

export interface TeachingMethod {
  methodId: string;
  name: string;
  description: string;
  framework: MethodFramework;
  ageRange: { min: number; max: number };
  applicableSubjects: string[];
  phases: MethodPhase[];
  systemPrompt: string;
  outputSchema: Record<string, unknown>;
  evaluationRubric: EvaluationCriteria[];
  isActive: boolean;
  version: string;
  createdAt: number;
}

// ── Lesson (PDF-sourced) ───────────────────────────────────────────────────

export interface LessonTocEntry {
  sectionId: string;
  title: string;
  level: number;
  pageStart: number;
}

export const LESSON_ACTIVITY_TYPES = [
  'recall', 'guided_practice', 'independent_practice', 'reflection', 'creative',
] as const;

export type LessonActivityType = typeof LESSON_ACTIVITY_TYPES[number];

export interface LessonActivity {
  type: LessonActivityType;
  instruction: string;
  hint: string;
  successCriteria: string;
}

export interface EvaluationAttempt {
  attempt: number;
  pass: boolean;
  issues: string[];
  timestamp: number;
}

export type LessonSectionStatus = 'raw' | 'generated' | 'needs_review' | 'approved';

export interface LessonSection {
  sectionId: string;
  title: string;
  pageStart: number;
  pageEnd: number;
  markdown: string;
  methodId: string;
  bloomLevel?: number;
  learningObjective?: string;
  prerequisiteKnowledge?: string;
  activities?: LessonActivity[];
  commonMisconceptions?: string[];
  status: LessonSectionStatus;
  generatedAt?: number;
  reviewedAt?: number;
  evaluationLog?: EvaluationAttempt[];
  parentNotes?: string;
}

export interface Lesson {
  lessonId: string;
  profileId: string;
  title: string;
  subject: string;
  pdfStoragePath: string;
  pageCount: number;
  toc: LessonTocEntry[];
  sections: LessonSection[];
  defaultMethodId: string;
  status: 'processing' | 'ready' | 'archived';
  parentReviewed: boolean;
  createdAt: number;
  updatedAt: number;
}

// ── Resource Directory ─────────────────────────────────────────────────────

export type SchoolType = 'sk' | 'srjk_c' | 'srjk_t' | 'kafa' | 'tadika' | 'other';

export const SCHOOL_TYPE_LABELS: Record<SchoolType, string> = {
  sk:      'SK',
  srjk_c: 'SRJKC',
  srjk_t: 'SRJKT',
  kafa:   'KAFA',
  tadika: 'Tadika',
  other:  'Other',
};

export const SUBJECTS = [
  'maths', 'malay', 'english', 'chinese', 'tamil',
  'science', 'islamic', 'moral', 'kafa', 'mixed',
] as const;

export type Subject = typeof SUBJECTS[number];

export const SUBJECT_LABELS: Record<Subject, string> = {
  maths:   'Matematik',
  malay:   'Bahasa Melayu',
  english: 'English',
  chinese: 'Bahasa Cina',
  tamil:   'Bahasa Tamil',
  science: 'Sains',
  islamic: 'Pendidikan Islam',
  moral:   'Pendidikan Moral',
  kafa:    'KAFA',
  mixed:   'Mixed / General',
};

export type ResourceStatus = 'pending' | 'extracting' | 'ready' | 'error';

export interface ResourceEntry {
  resourceId: string;
  url: string;
  label: string;
  sourceType: 'anyflip' | 'fliphtml5' | 'pdf_url' | 'website';
  schoolType: SchoolType;
  subject: Subject;
  yearLevel: number;      // 1–6 (Malaysian primary Tahun 1–6)
  description?: string;
  status: ResourceStatus;
  errorMessage?: string;
  pageCount?: number;
  addedBy: string;
  addedAt: number;
  extractedAt?: number;
  extractedContent?: {
    fullText: string;
    toc: Array<{ title: string; level: number; pageStart: number }>;
  };
}

export interface AnalyticsSession {
  sessionId: string;
  uid: string;
  profileId: string;
  lessonId: string;
  sectionId: string;
  methodId: string;
  subject: string;
  startedAt: number;
  completedAt?: number;
  timeToCompleteMs?: number;
  chatTurnsUsed: number;
  hintsRequested: number;
  completedWithoutHelp: boolean;
  successIndicator: boolean;
}

export interface MethodEffectiveness {
  methodId: string;
  subject: string;
  totalSessions: number;
  completionRate: number;
  avgChatTurns: number;
  avgTimeToCompleteMs: number;
  unaidedCompletionRate: number;
  lastUpdated: number;
}
