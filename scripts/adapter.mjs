#!/usr/bin/env node
/**
 * adapter.mjs — View current adapter wiring and generate new adapter stubs.
 *
 * The single swap-point for providers is src/adapters/index.ts.
 * Changing that file is all that's needed to switch AI provider or storage backend.
 *
 * Usage:
 *   node scripts/adapter.mjs status               # Show current wiring
 *   node scripts/adapter.mjs new-ai-stub --name=anthropic   # Generate AI adapter stub
 *   node scripts/adapter.mjs new-storage-stub --name=supabase
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT         = dirname(dirname(fileURLToPath(import.meta.url)));
const ADAPTERS_IDX = join(ROOT, 'src/adapters/index.ts');

function parseArgs() {
  const args  = process.argv.slice(2);
  const cmd   = args[0];
  const flags = Object.fromEntries(
    args
      .filter((a) => a.startsWith('--'))
      .map((a) => { const [k, v] = a.slice(2).split('='); return [k, v]; })
  );
  return { cmd, flags };
}

function readWiring() {
  const src = readFileSync(ADAPTERS_IDX, 'utf8');
  const ai      = src.match(/export const aiAdapter\s*=\s*(\w+)/)?.[1] ?? 'unknown';
  const mission = src.match(/export const missionStorage\s*=\s*(\w+)/)?.[1] ?? 'unknown';
  const chat    = src.match(/export const chatStorage\s*=\s*(\w+)/)?.[1] ?? 'unknown';
  return { ai, mission, chat };
}

const AI_STUB_TEMPLATE = (name) => `/**
 * ${name} AI adapter — implements AIPort.
 *
 * After filling in the implementation, update src/adapters/index.ts:
 *   import { ${name}Adapter } from './ai/${name}-adapter';
 *   export const aiAdapter = ${name}Adapter;
 */

import type { AIPort, AIChatMessage } from '@/ports/ai-port';
import { APP_CONFIG } from '@/config';

export const ${name}Adapter: AIPort = {
  async chat(
    messages: AIChatMessage[],
    model: string,
    temperature = 0.7
  ): Promise<string> {
    // TODO: implement ${name} API call
    throw new Error('${name}Adapter.chat() not yet implemented');
  },
};
`;

const STORAGE_STUB_TEMPLATE = (name) => `/**
 * ${name} storage adapters — implement MissionStoragePort + ChatStoragePort.
 *
 * After filling in the implementations, update src/adapters/index.ts:
 *   import { ${name}MissionAdapter, ${name}ChatAdapter } from './storage/${name}-adapter';
 *   export const missionStorage = ${name}MissionAdapter;
 *   export const chatStorage    = ${name}ChatAdapter;
 */

import type { MissionStoragePort, ChatStoragePort } from '@/ports/storage-port';
import type { Mission, ChatMessage } from '@/types';

export const ${name}MissionAdapter: MissionStoragePort = {
  subscribeMission(_profileId, _missionId, _onChange)  { throw new Error('not implemented'); },
  subscribeAllMissions(_profileId, _onChange)           { throw new Error('not implemented'); },
  async createMission(_profileId, _missionId, _data)   { throw new Error('not implemented'); },
  async updateMission(_profileId, _missionId, _patch)  { throw new Error('not implemented'); },
};

export const ${name}ChatAdapter: ChatStoragePort = {
  subscribeMessages(_missionId, _onChange)              { throw new Error('not implemented'); },
  async addMessage(_missionId, _msg)                    { throw new Error('not implemented'); return ''; },
  async getRecentMessages(_missionId, _limit)           { throw new Error('not implemented'); return []; },
};
`;

function main() {
  const { cmd, flags } = parseArgs();

  if (!cmd || cmd === 'status') {
    const w = readWiring();
    console.log('\nMission Room — adapter wiring (src/adapters/index.ts)\n');
    console.log(`  aiAdapter      →  ${w.ai}`);
    console.log(`  missionStorage →  ${w.mission}`);
    console.log(`  chatStorage    →  ${w.chat}`);
    console.log('\nTo swap a provider, edit src/adapters/index.ts and point to a different adapter.\n');
    return;
  }

  if (cmd === 'new-ai-stub') {
    const name = flags.name;
    if (!name) { console.error('Usage: node scripts/adapter.mjs new-ai-stub --name=<provider>'); process.exit(1); }
    const dir  = join(ROOT, 'src/adapters/ai');
    const file = join(dir, `${name}-adapter.ts`);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (existsSync(file)) { console.error(`File already exists: ${file}`); process.exit(1); }
    writeFileSync(file, AI_STUB_TEMPLATE(name), 'utf8');
    console.log(`\nGenerated: ${file}`);
    console.log(`Next: implement the chat() method, then update src/adapters/index.ts.\n`);
    return;
  }

  if (cmd === 'new-storage-stub') {
    const name = flags.name;
    if (!name) { console.error('Usage: node scripts/adapter.mjs new-storage-stub --name=<backend>'); process.exit(1); }
    const dir  = join(ROOT, 'src/adapters/storage');
    const file = join(dir, `${name}-adapter.ts`);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    if (existsSync(file)) { console.error(`File already exists: ${file}`); process.exit(1); }
    writeFileSync(file, STORAGE_STUB_TEMPLATE(name), 'utf8');
    console.log(`\nGenerated: ${file}`);
    console.log(`Next: implement the methods, then update src/adapters/index.ts.\n`);
    return;
  }

  console.error(`Unknown command: ${cmd}\nUsage: node scripts/adapter.mjs [status|new-ai-stub|new-storage-stub]`);
  process.exit(1);
}

main();
