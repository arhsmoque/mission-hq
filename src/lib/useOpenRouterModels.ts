/**
 * useOpenRouterModels — fetches the live OpenRouter model list and exposes
 * client-side filters for tier (free/paid) and modality (vision/text-only).
 *
 * The list is fetched once per session via React Query (stale 10 min).
 * On error the hook returns an empty list; the UI shows the error inline.
 */

import { useQuery } from '@tanstack/react-query';

export interface OrModel {
  id:             string;
  name:           string;
  description:    string;
  context_length: number;
  pricing: {
    prompt:     string;
    completion: string;
  };
  architecture: {
    modality:          string;
    input_modalities:  string[];
    output_modalities: string[];
  };
}

export type TierFilter    = 'all' | 'free' | 'paid';
export type ModalityFilter = 'all' | 'vision' | 'text';

async function fetchModels(): Promise<OrModel[]> {
  const res = await fetch('/api/openrouter/models');
  if (!res.ok) throw new Error(`Failed to load models: HTTP ${res.status}`);
  const data = await res.json() as { data?: OrModel[]; error?: string };
  if (data.error) throw new Error(data.error);
  return data.data ?? [];
}

export function isFree(m: OrModel): boolean {
  return m.pricing.prompt === '0' && m.pricing.completion === '0';
}

export function isVision(m: OrModel): boolean {
  return (
    m.architecture.input_modalities?.includes('image') ||
    m.architecture.modality?.includes('image') ||
    false
  );
}

export function useOpenRouterModels(tier: TierFilter, modality: ModalityFilter) {
  const query = useQuery<OrModel[], Error>({
    queryKey:  ['openrouter-models'],
    queryFn:   fetchModels,
    staleTime: 10 * 60 * 1000,
    retry:     1,
  });

  const filtered = (query.data ?? []).filter((m) => {
    if (tier === 'free' && !isFree(m)) return false;
    if (tier === 'paid' && isFree(m))  return false;
    if (modality === 'vision' && !isVision(m)) return false;
    if (modality === 'text'   && isVision(m))  return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => a.id.localeCompare(b.id));

  return {
    models:    sorted,
    allCount:  query.data?.length ?? 0,
    loading:   query.isLoading,
    error:     query.error?.message ?? null,
    refetch:   query.refetch,
  };
}
