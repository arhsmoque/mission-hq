/**
 * AI-driven campaign creation via ```campaign-action fences.
 *
 * The admin chat injects CAMPAIGN_SYSTEM_PROMPT + buildCampaignContext()
 * into its system message when Dir mode is active.  The AI produces
 * ```campaign-action blocks; the frontend parses + confirms + executes them.
 */

import { campaignStorage } from '@/adapters';
import { buildCampaign } from './dailyAgenda';
import type { Campaign, CampaignScope, Subject } from '@/types';
import type { ResourceEntry } from '@/types';

// ── Action schema ──────────────────────────────────────────────────────────

export interface CreateCampaignAction {
  action: 'create_campaign';
  profileId: string;
  type: 'exam_prep' | 'practice' | 'homework';
  label: string;
  deadline: string;        // ISO date "YYYY-MM-DD"
  resourceId: string;
  subject?: Subject;
  /** Page range — use when TOC is not reliable */
  scopePages?: { start: number; end: number };
  /** Section titles from the resource TOC */
  scopeSectionTitles?: string[];
}

export interface DeleteCampaignAction {
  action: 'delete_campaign';
  campaignId: string;
  label: string;
}

export type CampaignAction = CreateCampaignAction | DeleteCampaignAction;

// ── Parser ─────────────────────────────────────────────────────────────────

const FENCE_RE = /```campaign-action\n([\s\S]*?)```/g;

export function parseCampaignActions(text: string): CampaignAction[] {
  const actions: CampaignAction[] = [];
  const re = new RegExp(FENCE_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as CampaignAction;
      if (parsed?.action) actions.push(parsed);
    } catch { /* skip */ }
  }
  return actions;
}

export function stripCampaignFences(text: string): string {
  return text.replace(/```campaign-action\n[\s\S]*?```/g, '').trim();
}

// ── Executor ───────────────────────────────────────────────────────────────

/**
 * Resolve scope sections from a resource's TOC + action spec.
 * Priority: scopeSectionTitles (fuzzy match) → scopePages → entire book.
 */
function resolveScopeSections(
  resource: ResourceEntry,
  action: CreateCampaignAction,
): CampaignScope[] {
  const toc      = resource.extractedContent?.toc ?? [];
  const pageCount = resource.pageCount ?? 1;

  // Requested by section title
  if (action.scopeSectionTitles?.length) {
    const titles = action.scopeSectionTitles.map((t) => t.toLowerCase());
    const matched = toc.filter((e) =>
      titles.some((t) => e.title.toLowerCase().includes(t) || t.includes(e.title.toLowerCase()))
    );
    if (matched.length > 0) {
      const sorted = [...matched].sort((a, b) => a.pageStart - b.pageStart);
      return sorted.map((e, i) => {
        const nextStart = sorted[i + 1]?.pageStart ?? pageCount + 1;
        return {
          sectionId: `s_${i}`,
          title:     e.title,
          pageStart: e.pageStart,
          pageEnd:   nextStart - 1,
        };
      });
    }
  }

  // Requested by raw page range
  if (action.scopePages) {
    // Find TOC entries within the range
    const { start, end } = action.scopePages;
    const inRange = toc.filter(
      (e) => e.pageStart >= start && e.pageStart <= end && e.level <= 2,
    ).sort((a, b) => a.pageStart - b.pageStart);

    if (inRange.length > 0) {
      return inRange.map((e, i) => {
        const nextStart = inRange[i + 1]?.pageStart ?? end + 1;
        return {
          sectionId: `s_${i}`,
          title:     e.title,
          pageStart: e.pageStart,
          pageEnd:   Math.min(nextStart - 1, end),
        };
      });
    }
    // No TOC entries — treat entire range as one section
    return [{
      sectionId: 's_0',
      title:     `Pages ${start}–${end}`,
      pageStart: start,
      pageEnd:   end,
    }];
  }

  // Fallback: all level-1/2 TOC entries
  const topLevel = toc.filter((e) => e.level <= 2).sort((a, b) => a.pageStart - b.pageStart);
  if (topLevel.length > 0) {
    return topLevel.map((e, i) => {
      const nextStart = topLevel[i + 1]?.pageStart ?? pageCount + 1;
      return {
        sectionId: `s_${i}`,
        title:     e.title,
        pageStart: e.pageStart,
        pageEnd:   nextStart - 1,
      };
    });
  }

  return [{ sectionId: 's_0', title: resource.label, pageStart: 1, pageEnd: pageCount }];
}

export async function executeCampaignAction(
  action: CampaignAction,
  resource?: ResourceEntry,
): Promise<string> {
  if (action.action === 'delete_campaign') {
    await campaignStorage.deleteCampaign(action.campaignId);
    return `Deleted campaign "${action.label}"`;
  }

  if (action.action === 'create_campaign') {
    if (!resource) throw new Error('Resource not found — check resourceId');

    const deadlineMs  = new Date(action.deadline + 'T23:59:59').getTime();
    const scopeSections = resolveScopeSections(resource, action);

    const campaign = buildCampaign({
      profileId:     action.profileId,
      type:          action.type,
      label:         action.label,
      deadline:      deadlineMs,
      resourceId:    resource.resourceId,
      resourceLabel: resource.label,
      subject:       action.subject ?? resource.subject,
      scopeSections,
    });

    await campaignStorage.createCampaign(campaign);
    return `Created campaign "${campaign.label}" — ${campaign.sessionsTotal} sessions scheduled until ${action.deadline}`;
  }

  return 'Unknown campaign action';
}

// ── System prompt ──────────────────────────────────────────────────────────

export const CAMPAIGN_SYSTEM_PROMPT = `
You can create and delete learning campaigns using \`\`\`campaign-action blocks.

A campaign = a learning objective with a deadline and a scope from a textbook.
The system automatically schedules sessions across the available days.

CREATE a campaign:
\`\`\`campaign-action
{"action":"create_campaign","profileId":"<asma|aflah|haidar>","type":"<exam_prep|practice|homework>","label":"<human label>","deadline":"YYYY-MM-DD","resourceId":"<id from directory>","scopeSectionTitles":["Chapter 1","Chapter 2"],"subject":"<optional>"}
\`\`\`

CREATE using page range instead of section titles:
\`\`\`campaign-action
{"action":"create_campaign","profileId":"haidar","type":"exam_prep","label":"KAFA Ujian June","deadline":"2026-06-25","resourceId":"<id>","scopePages":{"start":1,"end":45}}
\`\`\`

DELETE a campaign:
\`\`\`campaign-action
{"action":"delete_campaign","campaignId":"<id>","label":"<display name>"}
\`\`\`

Rules:
- deadline must be a future date in YYYY-MM-DD format
- profileId must be one of: asma, aflah, haidar
- Use scopeSectionTitles when the resource has a TOC (preferred)
- Use scopePages when the exact page range is known
- Always confirm the deadline and scope with the user before creating
- For delete, always ask "Are you sure?" first
`.trim();

export function buildCampaignContext(campaigns: Campaign[]): string {
  if (campaigns.length === 0) return 'No active campaigns.';
  const lines = campaigns.map((c) => {
    const deadline = new Date(c.deadline).toLocaleDateString('en-MY');
    const done     = `${c.sessionsDone}/${c.sessionsTotal} sessions`;
    return `  [${c.campaignId}] "${c.label}" — ${c.profileId} — ${c.type} — due ${deadline} — ${done}`;
  });
  return `Active campaigns (${campaigns.length}):\n${lines.join('\n')}`;
}
