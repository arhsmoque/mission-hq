#!/usr/bin/env node
/**
 * profiles.mjs — Add, remove, or list child profiles in Mission Room.
 *
 * Usage:
 *   node scripts/profiles.mjs list
 *   node scripts/profiles.mjs add --id=zara --name=Zara --color=#fbbf24 --emoji=⭐
 *   node scripts/profiles.mjs remove --id=zara
 *
 * Edits: src/features/profile/profiles.ts
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT         = dirname(dirname(fileURLToPath(import.meta.url)));
const PROFILES_FILE = join(ROOT, 'src/features/profile/profiles.ts');

function parseArgs() {
  const args = process.argv.slice(2);
  const cmd  = args[0];
  const flags = Object.fromEntries(
    args
      .filter((a) => a.startsWith('--'))
      .map((a) => { const [k, v] = a.slice(2).split('='); return [k, v]; })
  );
  return { cmd, flags };
}

function readProfiles() {
  const src = readFileSync(PROFILES_FILE, 'utf8');
  const match = src.match(/export const PROFILES = \[([\s\S]*?)\] as const/);
  if (!match) throw new Error('Could not parse PROFILES array in profiles.ts');
  const entries = [...match[1].matchAll(/\{\s*id:\s*'([^']+)',\s*name:\s*'([^']+)',\s*color:\s*'([^']+)',\s*emoji:\s*'([^']+)'\s*\}/g)];
  return entries.map(([, id, name, color, emoji]) => ({ id, name, color, emoji }));
}

function writeProfiles(profiles) {
  const rows = profiles
    .map((p) => `  { id: '${p.id}', name: '${p.name}', color: '${p.color}', emoji: '${p.emoji}' }`)
    .join(',\n');
  const ids  = profiles.map((p) => `'${p.id}'`).join(' | ');
  const src  = `export const PROFILES = [\n${rows},\n] as const;\n\nexport type ProfileId = ${ids};\n`;
  writeFileSync(PROFILES_FILE, src, 'utf8');
  console.log('Written:', PROFILES_FILE);
}

function main() {
  const { cmd, flags } = parseArgs();

  if (!cmd || cmd === 'list') {
    const profiles = readProfiles();
    console.log('\nCurrent profiles:\n');
    profiles.forEach((p) => console.log(`  ${p.emoji}  ${p.name.padEnd(10)} id=${p.id}  color=${p.color}`));
    console.log('');
    return;
  }

  if (cmd === 'add') {
    const { id, name, color, emoji } = flags;
    if (!id || !name || !color || !emoji) {
      console.error('Usage: node scripts/profiles.mjs add --id=zara --name=Zara --color=#fbbf24 --emoji=⭐');
      process.exit(1);
    }
    const profiles = readProfiles();
    if (profiles.find((p) => p.id === id)) {
      console.error(`Profile '${id}' already exists.`);
      process.exit(1);
    }
    profiles.push({ id, name, color, emoji });
    writeProfiles(profiles);
    console.log(`Added profile: ${emoji} ${name} (id=${id})`);
    return;
  }

  if (cmd === 'remove') {
    const { id } = flags;
    if (!id) { console.error('Usage: node scripts/profiles.mjs remove --id=zara'); process.exit(1); }
    const profiles = readProfiles();
    const next = profiles.filter((p) => p.id !== id);
    if (next.length === profiles.length) { console.error(`Profile '${id}' not found.`); process.exit(1); }
    if (next.length === 0) { console.error('Cannot remove the last profile.'); process.exit(1); }
    writeProfiles(next);
    console.log(`Removed profile: ${id}`);
    return;
  }

  console.error(`Unknown command: ${cmd}\nUsage: node scripts/profiles.mjs [list|add|remove]`);
  process.exit(1);
}

main();
