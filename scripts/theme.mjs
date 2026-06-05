#!/usr/bin/env node
/**
 * theme.mjs — Change visual design tokens in Mission Room.
 *
 * Tokens live in two places:
 *   src/index.css  →  CSS custom properties (:root variables)
 *   index.html     →  Google Fonts URL (for font family changes)
 *
 * Usage:
 *   node scripts/theme.mjs list
 *   node scripts/theme.mjs set --font-size=18
 *   node scripts/theme.mjs set --font-family=Inter
 *   node scripts/theme.mjs set --color-accent="#fbbf24"
 *   node scripts/theme.mjs set --color-bg="#000000"
 *   node scripts/theme.mjs set --color-surface="#111111"
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const ROOT      = dirname(dirname(fileURLToPath(import.meta.url)));
const CSS_FILE  = join(ROOT, 'src/index.css');
const HTML_FILE = join(ROOT, 'index.html');

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

/** Replace or insert a CSS custom property in :root. */
function setCssVar(css, varName, value) {
  const escaped = varName.replace(/[-]/g, '\\-');
  const re = new RegExp(`(${escaped}\\s*:\\s*)[^;]+(;)`);
  if (re.test(css)) {
    return css.replace(re, `$1${value}$2`);
  }
  // Insert before closing brace of :root
  return css.replace(/(\:root\s*\{[^}]*)(\})/, `$1  ${varName}: ${value};\n$2`);
}

/** Read existing CSS variable value. */
function getCssVar(css, varName) {
  const escaped = varName.replace(/[-]/g, '\\-');
  const re = new RegExp(`${escaped}\\s*:\\s*([^;]+);`);
  return css.match(re)?.[1]?.trim() ?? '(not set)';
}

function main() {
  const { cmd, flags } = parseArgs();
  let css  = readFileSync(CSS_FILE,  'utf8');
  let html = readFileSync(HTML_FILE, 'utf8');

  if (!cmd || cmd === 'list') {
    console.log('\nMission Room design tokens\n');
    console.log(`  --font-size    :  ${getCssVar(css, '--font-size')}`);
    console.log(`  --font-body    :  ${getCssVar(css, '--font-body')}`);
    console.log(`  --color-bg     :  ${getCssVar(css, '--color-bg')}`);
    console.log(`  --color-surface:  ${getCssVar(css, '--color-surface')}`);
    console.log(`  --color-accent :  ${getCssVar(css, '--color-accent')}`);
    const fontUrlMatch = html.match(/fonts\.googleapis\.com[^"']+/);
    console.log(`  Google Font URL:  ${fontUrlMatch ? fontUrlMatch[0] : '(not found)'}`);
    console.log('\nEdit with:  node scripts/theme.mjs set --font-size=18\n');
    return;
  }

  if (cmd === 'set') {
    let changed = false;

    if (flags['font-size']) {
      const val = flags['font-size'].endsWith('px') ? flags['font-size'] : `${flags['font-size']}px`;
      css = setCssVar(css, '--font-size', val);
      // Also patch html font-size if set there
      css = css.replace(/(font-size:\s*)[\d.]+px(\s*;\s*\/\*\s*base\s*\*\/)/, `$1${val}$2`);
      console.log(`font-size → ${val}`);
      changed = true;
    }

    if (flags['color-accent']) {
      css = setCssVar(css, '--color-accent', flags['color-accent']);
      console.log(`--color-accent → ${flags['color-accent']}`);
      changed = true;
    }

    if (flags['color-bg']) {
      css = setCssVar(css, '--color-bg', flags['color-bg']);
      console.log(`--color-bg → ${flags['color-bg']}`);
      changed = true;
    }

    if (flags['color-surface']) {
      css = setCssVar(css, '--color-surface', flags['color-surface']);
      console.log(`--color-surface → ${flags['color-surface']}`);
      changed = true;
    }

    if (flags['font-family']) {
      const family = flags['font-family'];
      css = setCssVar(css, '--font-body', `'${family}', sans-serif`);
      // Update Google Fonts URL in index.html
      const encoded = encodeURIComponent(family).replace(/%20/g, '+');
      html = html.replace(
        /(family=)[^&"']+/,
        `$1${encoded}:wght@400;500;600;700;800;900`
      );
      console.log(`font-family → ${family}`);
      console.log('Note: Google Fonts URL updated in index.html — verify the weight range is correct.');
      changed = true;
    }

    if (!changed) {
      console.error('No known flag provided. Options: --font-size --font-family --color-accent --color-bg --color-surface');
      process.exit(1);
    }

    writeFileSync(CSS_FILE,  css,  'utf8');
    writeFileSync(HTML_FILE, html, 'utf8');
    console.log('\nSaved. Rebuild the app to see changes: npm run build');
    return;
  }

  console.error(`Unknown command: ${cmd}\nUsage: node scripts/theme.mjs [list|set]`);
  process.exit(1);
}

main();
