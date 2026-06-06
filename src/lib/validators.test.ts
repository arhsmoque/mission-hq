import { describe, it, expect } from 'vitest';
import { moduleSchema } from './validators';

const validModule = (overrides = {}) => ({
  id: 1,
  title: 'Read the Problem',
  goal: 'Understand what is being asked',
  hint: 'Circle key words',
  reflectionPrompt: 'What does the question ask for?',
  ...overrides,
});

const validPayload = (overrides = {}) => ({
  missionTitle: 'Test Mission',
  modules: [validModule({ id: 1 }), validModule({ id: 2 }), validModule({ id: 3 })],
  ...overrides,
});

describe('moduleSchema', () => {
  it('accepts a valid payload', () => {
    expect(() => moduleSchema.parse(validPayload())).not.toThrow();
  });

  it('rejects fewer than 3 modules', () => {
    expect(() => moduleSchema.parse(validPayload({ modules: [validModule()] }))).toThrow();
  });

  it('rejects more than 8 modules', () => {
    const modules = Array.from({ length: 9 }, (_, i) => validModule({ id: i + 1 }));
    expect(() => moduleSchema.parse(validPayload({ modules }))).toThrow();
  });

  it('rejects an empty missionTitle', () => {
    expect(() => moduleSchema.parse(validPayload({ missionTitle: '' }))).toThrow();
  });

  it('rejects a module with a non-positive id', () => {
    const modules = [validModule({ id: 0 }), validModule({ id: 2 }), validModule({ id: 3 })];
    expect(() => moduleSchema.parse(validPayload({ modules }))).toThrow();
  });

  it('rejects a module with an empty title', () => {
    const modules = [validModule({ id: 1, title: '' }), validModule({ id: 2 }), validModule({ id: 3 })];
    expect(() => moduleSchema.parse(validPayload({ modules }))).toThrow();
  });

  it('accepts an optional example field', () => {
    const result = moduleSchema.parse(
      validPayload({ modules: [validModule({ id: 1, example: 'e.g. 2+3' }), validModule({ id: 2 }), validModule({ id: 3 })] })
    );
    expect(result.modules[0].example).toBe('e.g. 2+3');
  });
});
