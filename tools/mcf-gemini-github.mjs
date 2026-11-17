#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { applyHandoff, prepareHandoff, validateHandoff } from '../src/gemini-github-broker.mjs';

const usage = [
  'MCF Gemini GitHub gateway — isolated draft PRs only',
  'Usage:',
  '  node tools/mcf-gemini-github.mjs prepare manifest.json',
  '  node tools/mcf-gemini-github.mjs apply manifest.json --approve-digest=SHA256',
  'Approval must come from a separate MESTRE/human review of the manifest.',
  'No credentials are passed to Gemini. No merge, deploy, force push or deletion.'
].join('\n');

async function main() {
  const [, , action, filename, ...flags] = process.argv;
  if (action === '--help' || action === '-h') {
    process.stdout.write(usage + '\n');
    return;
  }
  if (!['prepare', 'apply'].includes(action) || !filename) {
    throw new Error(usage);
  }
  if (flags.some((flag) => !/^--approve-digest=[a-f0-9]{64}$/.test(flag))) {
    throw new Error('Unrecognized or invalid option');
  }
  const text = readFileSync(resolve(filename), 'utf8');
  if (Buffer.byteLength(text, 'utf8') > 96 * 1024) throw new Error('Manifest too large');
  const manifest = JSON.parse(text);
  const validation = validateHandoff(manifest);
  if (!validation.ok) throw new Error('Validation failed: ' + validation.errors.join('; '));
  if (action === 'prepare') {
    if (flags.length) throw new Error('prepare does not accept approval flags');
    process.stdout.write(JSON.stringify(await prepareHandoff(manifest), null, 2) + '\n');
    return;
  }
  if (flags.length !== 1) throw new Error('apply requires one exact --approve-digest=SHA256');
  const approvedDigest = flags[0].slice('--approve-digest='.length);
  process.stdout.write(JSON.stringify(await applyHandoff(manifest, approvedDigest), null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write('MCF_GATEWAY_ERROR: ' + error.message + '\n');
  process.exitCode = 1;
});
