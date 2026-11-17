import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAgentContribution } from '../src/agent-contribution.mjs';

const validContribution = Object.freeze({
  mission_id: 'MCF-GIT-GITHUB-COLLAB-20261117-001',
  agent_id: 'chatgpt',
  branch: 'experiment/mcf-git-round-20261117-chatgpt',
  commit_sha: 'a'.repeat(40),
  evidence_url: 'https://github.com/leon337/mcf-parallel-chat/pull/1',
});

const withField = (field, value) => ({ ...validContribution, [field]: value });

const rejectsField = (contribution, field) => {
  const result = validateAgentContribution(contribution);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.startsWith(field + ' ')), JSON.stringify(result));
};

test('accepts a valid contribution and does not mutate the input', () => {
  assert.deepEqual(validateAgentContribution(validContribution), { valid: true, errors: [] });
  assert.equal(validContribution.agent_id, 'chatgpt');
});

test('accepts uppercase hexadecimal commit SHAs and nested Git branch names', () => {
  const result = validateAgentContribution({
    ...validContribution,
    commit_sha: 'ABCDEF0123456789'.repeat(2) + 'ABCDEF01',
    branch: 'feature/mcf/round-1',
  });
  assert.deepEqual(result, { valid: true, errors: [] });
});

test('rejects non-object envelopes', () => {
  for (const value of [null, undefined, '', 42, [], true]) {
    assert.deepEqual(validateAgentContribution(value), {
      valid: false,
      errors: ['contribution must be an object'],
    });
  }
});

test('requires every field', () => {
  for (const field of Object.keys(validContribution)) {
    const withoutField = { ...validContribution };
    delete withoutField[field];
    rejectsField(withoutField, field);
  }
});

test('rejects malformed mission and agent identifiers', () => {
  for (const field of ['mission_id', 'agent_id']) {
    for (const invalid of ['', ' ', 'name with spaces', 'bad/segment', '_starts-with-underscore', 123, null]) {
      rejectsField(withField(field, invalid), field);
    }
  }
});

test('rejects unsafe or invalid Git branch names', () => {
  for (const invalid of ['', '-bad', 'main..backup', 'topic//name', 'topic/.hidden', 'topic/a.lock',
    'topic name', 'topic@{1}', 'name?', 'ref\\name', 'topic/', '@', null]) {
    rejectsField(withField('branch', invalid), 'branch');
  }
});

test('requires a 40-character hexadecimal commit SHA', () => {
  for (const invalid of ['', 'a'.repeat(39), 'a'.repeat(41), 'g'.repeat(40),
    'A'.repeat(39) + 'z', 123, null]) {
    rejectsField(withField('commit_sha', invalid), 'commit_sha');
  }
});

test('requires absolute HTTPS evidence URLs without embedded credentials', () => {
  for (const invalid of ['', 'http://example.com/x', 'https://', '/relative/path',
    'ftp://example.com/x', 'https://user:pass@example.com/x',
    ' https://example.com/x ', 'https://example.com/\n', null]) {
    rejectsField(withField('evidence_url', invalid), 'evidence_url');
  }
});

test('returns all invalid-field errors in a deterministic order', () => {
  const result = validateAgentContribution({});
  assert.equal(result.valid, false);
  assert.deepEqual(result.errors.map((error) => error.split(' ')[0]), [
    'mission_id', 'agent_id', 'branch', 'commit_sha', 'evidence_url',
  ]);
});
