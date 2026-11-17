import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HANDOFF_SCHEMA, ALLOWED_REPOSITORY, validateHandoff, proposalDigest,
  prepareHandoff, applyHandoff, GithubApiError
} from '../src/gemini-github-broker.mjs';

const BASE = '3ca6aa86dff804be6d3a5823241e6c94650bd931';
const BRANCH = 'experiment/mcf-gemini-github-e2e-20261117';
const PATH = 'docs/experiments/gemini-github-bridge/GEMINI-INTEGRATION-E2E-20261117.md';

function valid(overrides = {}) {
  return {
    schema_version: HANDOFF_SCHEMA,
    mission_id: 'MCF-GEMINI-GITHUB-INTEGRATION-20261117-001',
    agent_id: 'gemini',
    repository: ALLOWED_REPOSITORY,
    base_sha: BASE,
    branch: BRANCH,
    path: PATH,
    content: '# Relatorio do Gemini\n\nContribuicao original recebida do Drive pelo MESTRE.\n',
    source_url: 'https://docs.google.com/document/d/1R_W_3ndGbslukhlkb_31tnA7VsLW6OMgqIPIlx_STsY/edit',
    source_revision: 'AHj4eMQEWYw5uCq7pcQ2OwSMj6hhghi0_-Bk51RnThJdvOH3_-D5NhuCpqBIe0IRsznYdj0cu6hzFUrNWsmJlkY1olTJDZYkLzoUThDTI5M',
    pr_title: 'docs(gemini): validate governed GitHub relay',
    pr_body: 'Gemini-authored content, human-reviewed and published by MESTRE in draft only.',
    ...overrides
  };
}

function fakeGithub(options = {}) {
  const calls = [];
  let branchSha = options.branchSha ?? null;
  let fileContent = options.fileContent ?? null;
  const prs = [];
  const gh = async (method, endpoint, payload) => {
    calls.push({ method, endpoint, payload });
    if (options.unauthorized) throw new GithubApiError('denied', 403);
    if (method === 'GET' && endpoint.endsWith('/git/ref/heads/main')) {
      return { object: { sha: options.mainSha || BASE } };
    }
    if (method === 'GET' && endpoint.endsWith('/git/ref/heads/' + BRANCH)) {
      if (!branchSha) throw new GithubApiError('not found', 404);
      return { object: { sha: branchSha } };
    }
    if (method === 'GET' && endpoint.includes('/contents/' + PATH + '?ref=')) {
      if (fileContent === null) throw new GithubApiError('not found', 404);
      return { type: 'file', encoding: 'base64', content: Buffer.from(fileContent).toString('base64') };
    }
    if (method === 'GET' && endpoint.includes('/compare/')) {
      return {
        behind_by: 0,
        files: fileContent === null
          ? options.unexpectedFiles || []
          : [{ filename: PATH, status: 'added' }],
        commits: [{ sha: branchSha || BASE }]
      };
    }
    if (method === 'POST' && endpoint.endsWith('/git/refs')) {
      assert.equal(payload.sha, BASE);
      branchSha = BASE;
      return { object: { sha: BASE } };
    }
    if (method === 'PUT' && endpoint.endsWith('/contents/' + PATH)) {
      assert.equal(payload.branch, BRANCH);
      fileContent = Buffer.from(payload.content, 'base64').toString('utf8');
      branchSha = 'f'.repeat(40);
      return { commit: { sha: branchSha } };
    }
    if (method === 'GET' && endpoint.includes('/pulls?state=open')) return prs;
    if (method === 'POST' && endpoint.endsWith('/pulls')) {
      assert.equal(payload.draft, true);
      assert.equal(payload.base, 'main');
      assert.equal(payload.head, BRANCH);
      const pr = {
        number: 7, state: 'open', draft: true,
        head: { ref: BRANCH }, html_url: 'https://github.com/leon337/mcf-parallel-chat/pull/7'
      };
      prs.push(pr);
      return pr;
    }
    throw new Error('Unexpected fake GitHub operation: ' + method + ' ' + endpoint);
  };
  return { gh, calls, prs, get fileContent() { return fileContent; } };
}

test('validates the complete authorized manifest', () => {
  assert.deepEqual(validateHandoff(valid()), { ok: true, errors: [] });
  assert.match(proposalDigest(valid()), /^[a-f0-9]{64}$/);
});

test('rejects wrong schema, impersonated agent, repo and main branch writes', () => {
  for (const overrides of [
    { schema_version: 'unknown/v1' }, { agent_id: 'mestre' },
    { repository: 'leon337/multiagent-collaboration-framework' },
    { branch: 'main' }, { branch: 'experiment/mcf-gemini-github-../main' },
    { branch: 'experiment/mcf-gemini-github-name.lock' }, { base_sha: 'a'.repeat(39) }
  ]) assert.equal(validateHandoff(valid(overrides)).ok, false, JSON.stringify(overrides));
});

test('rejects traversal, out-of-scope paths, unsafe URLs and credentials', () => {
  for (const overrides of [
    { path: '../../README.md' }, { path: 'src/server.mjs' },
    { path: 'docs/experiments/gemini-github-bridge/GEMINI-../SECRET.md' },
    { source_url: 'http://docs.google.com/document/d/1R_W_3ndGbslukhlkb_31tnA7VsLW6OMgqIPIlx_STsY/edit' },
    { source_url: 'https://evil.example/doc' },
    { content: 'a'.repeat(65537) },
    { content: 'header\ngithub_pat_' + 'a'.repeat(30) + '\nfooter' },
    { source_revision: 'notvalid' },
    { extra_field: 'not-allowed' }
  ]) assert.equal(validateHandoff(valid(overrides)).ok, false, JSON.stringify(Object.keys(overrides)));
});

test('digest changes for any source or content change', () => {
  const a = proposalDigest(valid());
  assert.notEqual(a, proposalDigest(valid({ content: valid().content + 'change' })));
  assert.notEqual(a, proposalDigest(valid({ source_revision: 'AnotherRevisionWithEnoughChars123' })));
});

test('prepare is read-only and returns a scoped approval digest', async () => {
  const f = fakeGithub();
  const plan = await prepareHandoff(valid(), f.gh);
  assert.equal(plan.decision, 'PREPARED_NOT_PUBLISHED');
  assert.equal(plan.branch_exists, false);
  assert.equal(plan.file_exists, false);
  assert.equal(plan.manifest_digest, proposalDigest(valid()));
  assert.equal(f.calls.some((c) => c.method !== 'GET'), false);
});

test('apply fails closed without exact digest, before any GitHub request', async () => {
  const f = fakeGithub();
  await assert.rejects(applyHandoff(valid(), null, f.gh), /HUMAN_GATE/);
  await assert.rejects(applyHandoff(valid(), 'a'.repeat(64), f.gh), /HUMAN_GATE/);
  assert.equal(f.calls.length, 0);
});

test('apply creates only a branch, file and open draft PR with readback', async () => {
  const f = fakeGithub();
  const receipt = await applyHandoff(valid(), proposalDigest(valid()), f.gh);
  assert.equal(receipt.decision, 'DRAFT_PR_PUBLISHED');
  assert.equal(receipt.pr_number, 7);
  assert.equal(receipt.draft, true);
  assert.equal(receipt.main_untouched, true);
  assert.equal(receipt.verified, true);
  assert.equal(f.fileContent, valid().content);
  assert.deepEqual(
    f.calls.filter((c) => c.method !== 'GET').map((c) => c.method),
    ['POST', 'PUT', 'POST']
  );
  assert.ok(f.calls.every((c) => !/merge|deploy|delete/i.test(c.endpoint)));
});

test('replay is idempotent and never creates duplicate commit or PR', async () => {
  const f = fakeGithub();
  await applyHandoff(valid(), proposalDigest(valid()), f.gh);
  const beforeWrites = f.calls.filter((c) => c.method !== 'GET').length;
  const receipt = await applyHandoff(valid(), proposalDigest(valid()), f.gh);
  assert.equal(receipt.decision, 'DRAFT_PR_PUBLISHED');
  assert.equal(f.prs.length, 1);
  assert.equal(f.calls.filter((c) => c.method !== 'GET').length, beforeWrites);
});

test('rejects stale main, conflicted branches and unauthorized GitHub access', async () => {
  await assert.rejects(
    prepareHandoff(valid(), fakeGithub({ mainSha: 'b'.repeat(40) }).gh),
    /STALE_BASE/
  );
  await assert.rejects(
    prepareHandoff(valid(), fakeGithub({ branchSha: 'f'.repeat(40), unexpectedFiles: [{ filename: 'README.md' }] }).gh),
    /BRANCH_CONFLICT/
  );
  await assert.rejects(
    prepareHandoff(valid(), fakeGithub({ unauthorized: true }).gh),
    /denied/
  );
});

test('rejects an existing file with differing content', async () => {
  await assert.rejects(
    applyHandoff(valid(), proposalDigest(valid()), fakeGithub({
      branchSha: 'f'.repeat(40), fileContent: 'tampered'
    }).gh),
    /CONFLICT/
  );
});

test('rejects non-draft review before mutating GitHub', async () => {
  const f = fakeGithub();
  f.prs.push({ number: 8, state: 'open', draft: false, head: { ref: BRANCH } });
  await assert.rejects(
    applyHandoff(valid(), proposalDigest(valid()), f.gh),
    /NON_DRAFT_PR/
  );
  assert.equal(f.calls.some((c) => c.method !== 'GET'), false);
});
