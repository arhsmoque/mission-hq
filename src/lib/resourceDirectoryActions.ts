/**
 * AI-driven resource directory actions.
 *
 * The AI embeds ```resource-action JSON fences in its response.
 * parseDirectoryActions() extracts them; executeDirectoryAction() runs them.
 * DIRECTORY_SYSTEM_PROMPT and buildDirectoryContext() are injected into the
 * admin chat when "Dir" mode is active.
 */

import { resourceDirectory } from '@/adapters';
import { detectSource } from './sourceDetector';
import type { ResourceEntry, SchoolType, Subject } from '@/types';

// ── Action schema ──────────────────────────────────────────────────────────

export type AddAction = {
  action: 'add';
  url: string;
  label: string;
  schoolType: SchoolType;
  subject: Subject;
  yearLevel: number;
  description?: string;
};

export type EditAction = {
  action: 'edit';
  resourceId: string;
  label?: string;
  url?: string;
  schoolType?: SchoolType;
  subject?: Subject;
  yearLevel?: number;
  description?: string;
};

export type DeleteAction = {
  action: 'delete';
  resourceId: string;
  label: string;
};

export type DirectoryAction = AddAction | EditAction | DeleteAction;

// ── Parser ─────────────────────────────────────────────────────────────────

const FENCE_PATTERN = /```resource-action\n([\s\S]*?)```/g;

export function parseDirectoryActions(text: string): DirectoryAction[] {
  const actions: DirectoryAction[] = [];
  const re = new RegExp(FENCE_PATTERN.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    try {
      const parsed = JSON.parse(match[1].trim()) as DirectoryAction;
      if (parsed && typeof parsed.action === 'string') {
        actions.push(parsed);
      }
    } catch {
      // skip malformed blocks
    }
  }
  return actions;
}

/** Strip action fence blocks from display text. */
export function stripActionFences(text: string): string {
  return text.replace(/```resource-action\n[\s\S]*?```/g, '').trim();
}

// ── Executor ───────────────────────────────────────────────────────────────

export async function executeDirectoryAction(
  action: DirectoryAction,
  addedBy: string,
): Promise<string> {
  if (action.action === 'add') {
    const source = detectSource(action.url);
    const entry: Omit<ResourceEntry, 'resourceId'> = {
      url:        action.url.trim(),
      label:      action.label,
      sourceType: source.type,
      schoolType: action.schoolType,
      subject:    action.subject,
      yearLevel:  action.yearLevel,
      status:     'pending',
      addedBy,
      addedAt:    Date.now(),
      ...(action.description !== undefined && { description: action.description }),
    };
    const id = await resourceDirectory.addResource(entry);
    return `Added "${action.label}" — ID: ${id}`;
  }

  if (action.action === 'edit') {
    const { action: _a, resourceId, ...rawPatch } = action;
    const patch = Object.fromEntries(
      Object.entries(rawPatch).filter(([, v]) => v !== undefined)
    ) as Partial<ResourceEntry>;
    await resourceDirectory.updateResource(resourceId, patch);
    return `Updated "${resourceId}"`;
  }

  if (action.action === 'delete') {
    await resourceDirectory.deleteResource(action.resourceId);
    return `Deleted "${action.label}"`;
  }

  return 'Unknown action type';
}

// ── System prompt ──────────────────────────────────────────────────────────

export const DIRECTORY_SYSTEM_PROMPT = `
You can manage the Mission HQ resource directory using structured action blocks.
When the user wants to add, edit, or delete a resource, include a \`\`\`resource-action JSON block.

ADD:
\`\`\`resource-action
{"action":"add","url":"<anyflip/fliphtml5/pdf url>","label":"<human label>","schoolType":"<sk|srjk_c|srjk_t|kafa|tadika|other>","subject":"<maths|malay|english|chinese|tamil|science|islamic|moral|kafa|mixed>","yearLevel":<1-6>}
\`\`\`

EDIT (include only fields to change):
\`\`\`resource-action
{"action":"edit","resourceId":"<id>","label":"<new label>"}
\`\`\`

DELETE (always confirm with the user first):
\`\`\`resource-action
{"action":"delete","resourceId":"<id>","label":"<display name>"}
\`\`\`

## URL metadata — IMPORTANT
When the user pastes an AnyFlip or FlipHTML5 URL, the app automatically fetches the page and appends a [Fetched from URL] block containing the book title and description. You MUST use this to infer all required fields — do NOT say you cannot open URLs or browse the web. The metadata is already in the message.

Inference rules from Malaysian primary school book titles:
- "KAFA" in title → schoolType: "kafa", subject: "kafa"
- "Pendidikan Islam" → subject: "islamic"
- "Pendidikan Moral" → subject: "moral"
- "Bahasa Melayu" / "BM" → subject: "malay"
- "English" → subject: "english"
- "Matematik" / "Maths" → subject: "maths"
- "Sains" / "Science" → subject: "science"
- "Bahasa Cina" / "Mandarin" / "SRJK(C)" → subject: "chinese", schoolType: "srjk_c"
- "Tamil" / "SRJK(T)" → subject: "tamil", schoolType: "srjk_t"
- "Tahun 1"–"Tahun 6" → yearLevel 1–6
- Default schoolType: "sk" unless title/description says otherwise

If you can infer all 4 fields confidently, generate the resource-action block immediately without asking. Only ask if a field genuinely cannot be determined.

## Other rules
- yearLevel must be 1–6 (Malaysian primary Tahun 1–6)
- sourceType is auto-detected from the URL — do not include it
- For delete, always ask "Are you sure?" before outputting the block
- You may include normal explanatory text before or after the block
`.trim();

// ── Directory context builder ──────────────────────────────────────────────

export function buildDirectoryContext(resources: ResourceEntry[]): string {
  if (resources.length === 0) {
    return 'The resource directory is currently empty.';
  }
  const lines = resources.map((r) =>
    `  [${r.resourceId}] "${r.label}" — Yr${r.yearLevel} ${r.subject}/${r.schoolType} — ${r.sourceType} — ${r.status}`,
  );
  return `Current resource directory (${resources.length} entries):\n${lines.join('\n')}`;
}
