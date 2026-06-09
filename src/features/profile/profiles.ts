import type { SchoolType } from '@/types';

export const PROFILES = [
  { id: 'asma',   name: 'Asma',   color: '#fda4af', emoji: '🌸', yearLevel: 5, schoolType: 'srjk_c' as SchoolType },
  { id: 'aflah',  name: 'Aflah',  color: '#86efac', emoji: '⚡', yearLevel: 3, schoolType: 'srjk_c' as SchoolType },
  { id: 'haidar', name: 'Haidar', color: '#7dd3fc', emoji: '🚀', yearLevel: 1, schoolType: 'kafa'   as SchoolType },
] as const;

export type ProfileId = typeof PROFILES[number]['id'];
