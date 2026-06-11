import { describe, expect, it } from 'vitest';
import { buildBasicMissionFromOcr, normalizeGeneratedMission } from './missionGeneration';

describe('mission generation helpers', () => {
  it('removes undefined examples before Firebase persistence', () => {
    const result = normalizeGeneratedMission({
      missionTitle: '  Fractions mission  ',
      modules: [
        {
          id: 1,
          title: 'Read',
          goal: 'Understand',
          hint: 'Look carefully',
          example: null,
          reflectionPrompt: 'What is asked?',
        },
        {
          id: 2,
          title: 'Plan',
          goal: 'Choose method',
          hint: 'Think first',
          reflectionPrompt: 'Why this method?',
        },
        {
          id: 3,
          title: 'Check',
          goal: 'Verify',
          hint: 'Check answer',
          example: 'A small example',
          reflectionPrompt: 'Does it fit?',
        },
      ],
    });

    expect(result.missionTitle).toBe('Fractions mission');
    expect('example' in result.modules[0]).toBe(false);
    expect('example' in result.modules[1]).toBe(false);
    expect(result.modules[2].example).toBe('A small example');
  });

  it('builds a usable basic mission when AI generation is unavailable', () => {
    const result = buildBasicMissionFromOcr('12 + 8 = ___\nFind the total number of apples.');

    expect(result.missionTitle).toBe('Maths Practice Mission');
    expect(result.modules).toHaveLength(3);
    expect(result.modules.every((m) => m.isComplete === false)).toBe(true);
    expect(result.modules.map((m) => m.id)).toEqual([1, 2, 3]);
  });
});
