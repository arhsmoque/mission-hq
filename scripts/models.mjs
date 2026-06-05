#!/usr/bin/env node
/**
 * models.mjs — Manage AI models available in Mission Room.
 *
 * Usage:
 *   node scripts/models.mjs list
 *   node scripts/models.mjs set-default --id="deepseek/deepseek-chat-v3-0324:free"
 *   node scripts/models.mjs add --id="x/y" --name="Name" --provider=X --description="Desc" --context=128000
 *   node scripts/models.mjs remove --id="google/gemini-flash-1.5"
 *
 * Edits: src/lib/models.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT        = dirname(dirname(fileURLToPath(import.meta.url)));
const MODELS_FILE = join(ROOT, 'src/lib/models.ts');

function parseArgs() {
  const args  = process.argv.slice(2);
  const cmd   = args[0];
  const flags = Object.fromEntries(
    args
      .filter((a) => a.startsWith('--'))
      .map((a) => { const [k, ...rest] = a.slice(2).split('='); return [k, rest.join('=')]; })
  );
  return { cmd, flags };
}

function readModels() {
  const src     = readFileSync(MODELS_FILE, 'utf8');
  const arrMatch = src.match(/export const AVAILABLE_MODELS[\s\S]*?=\s*(\[[\s\S]*?\]);/);
  const defMatch = src.match(/export const DEFAULT_MODEL_ID\s*=\s*'([^']+)'/);
  if (!arrMatch || !defMatch) throw new Error('Could not parse models.ts');
  const models = JSON.parse(arrMatch[1].replace(/,\s*\n\s*\]/g, '\n]'));
  return { models, defaultId: defMatch[1] };
}

function writeModels(models, defaultId) {
  const rows = models.map((m) => `  {\n    id:            '${m.id}',\n    name:          '${m.name}',\n    provider:      '${m.provider}',\n    description:   '${m.description}',\n    contextWindow: ${m.contextWindow},\n  }`).join(',\n');
  const src = `export interface LlmModel {\n  id: string;\n  name: string;\n  provider: string;\n  description: string;\n  contextWindow: number;\n}\n\nexport const AVAILABLE_MODELS: LlmModel[] = [\n${rows},\n];\n\nexport const DEFAULT_MODEL_ID = '${defaultId}';\n`;
  writeFileSync(MODELS_FILE, src, 'utf8');
  console.log('Written:', MODELS_FILE);
}

function main() {
  const { cmd, flags } = parseArgs();

  if (!cmd || cmd === 'list') {
    const { models, defaultId } = readModels();
    console.log('\nAvailable models:\n');
    models.forEach((m) => {
      const marker = m.id === defaultId ? ' (default)' : '';
      console.log(`  ${m.name.padEnd(26)} ${m.id}${marker}`);
    });
    console.log('');
    return;
  }

  if (cmd === 'set-default') {
    const { id } = flags;
    if (!id) { console.error('Usage: node scripts/models.mjs set-default --id="..."'); process.exit(1); }
    const { models, defaultId: current } = readModels();
    if (!models.find((m) => m.id === id)) {
      console.error(`Model '${id}' not in AVAILABLE_MODELS. Add it first.`);
      process.exit(1);
    }
    writeModels(models, id);
    console.log(`Default model changed: ${current} → ${id}`);
    return;
  }

  if (cmd === 'add') {
    const { id, name, provider, description, context } = flags;
    if (!id || !name || !provider || !description) {
      console.error('Usage: node scripts/models.mjs add --id="..." --name="..." --provider=X --description="..." --context=128000');
      process.exit(1);
    }
    const { models, defaultId } = readModels();
    if (models.find((m) => m.id === id)) { console.error(`Model '${id}' already exists.`); process.exit(1); }
    models.push({ id, name, provider, description, contextWindow: parseInt(context ?? '128000', 10) });
    writeModels(models, defaultId);
    console.log(`Added model: ${name} (${id})`);
    return;
  }

  if (cmd === 'remove') {
    const { id } = flags;
    if (!id) { console.error('Usage: node scripts/models.mjs remove --id="..."'); process.exit(1); }
    const { models, defaultId } = readModels();
    const next = models.filter((m) => m.id !== id);
    if (next.length === models.length) { console.error(`Model '${id}' not found.`); process.exit(1); }
    const newDefault = id === defaultId ? (next[0]?.id ?? '') : defaultId;
    writeModels(next, newDefault);
    console.log(`Removed model: ${id}${id === defaultId ? ` (default reset to ${newDefault})` : ''}`);
    return;
  }

  console.error(`Unknown command: ${cmd}\nUsage: node scripts/models.mjs [list|set-default|add|remove]`);
  process.exit(1);
}

main();
