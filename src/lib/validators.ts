import { z } from 'zod';

export const moduleSchema = z.object({
  missionTitle: z.string().min(1).max(200),
  client: z.string().optional(),
  modules: z
    .array(
      z.object({
        id: z.number().int().positive(),
        title: z.string().min(1).max(200),
        goal: z.string().min(1).max(500),
        hint: z.string().min(1).max(500),
        example: z.string().max(1000).optional().nullable(),
        reflectionPrompt: z.string().min(1).max(500),
      })
    )
    .min(3)
    .max(8),
});

export type ModuleGenOutput = z.infer<typeof moduleSchema>;
