export const PROFILES = [
  { id: 'asma',   name: 'Asma',   color: '#fda4af', emoji: '🌸' },
  { id: 'aflah',  name: 'Aflah',  color: '#86efac', emoji: '⚡' },
  { id: 'haidar', name: 'Haidar', color: '#7dd3fc', emoji: '🚀' },
] as const;

export type ProfileId = typeof PROFILES[number]['id'];
