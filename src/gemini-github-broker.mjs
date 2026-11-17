import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

export const HANDOFF_SCHEMA = 'mcf-gemini-github-handoff/v1';
export const ALLOWED_REPOSITORY = 'leon337/mcf-parallel-chat';
const SHA40 = /^[a-f0-9]{40}$/i;
const BRANCH = /^experiment\/mcf-gemini-github-[a-z0-9][a-z0-9-]{0,65}$/;
const TARGET_PATH = /^docs\/experiments\/gemini-github-bridge\/GEMINI-[A-Za-z0-9._-]+\.md$/;
const SOURCE_URL = /^https:\/\/docs\.google\.com\/document\/d\/[A-Za-z0-9_-]{15,}\/(?:edit(?:[?#].*)?)?$/;
const FIELDS = [
  'schema_version', 'mission_id', 'agent_id', 'repository',
  'base_sha', 'branch', 'path', 'content', 'source_url',
  'source_revision', 'pr_title', 'pr_body'
];
const SENSITIVE = [
  /-----BEGIN (?:RSA |OPENSSH |EC |DSA )?PRIVATE KEY-----/,
  /github_pat_[A-Za-z0-9_]{20,}/,
  /gh[pousr]_[A-Za-z0-9_]{20,}/,
  /sk-proj-[A-Za-z0-9_-]{20,}/
];

export function validateHandoff(input) {
  const errors = [];
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, errors: ['handoff must be a JSON object'] };
  }
  for (const key of Object.keys(input)) {
    if (!FIELDS.includes(key)) errors.push('unknown field: ' + key);
  }
  if (input.schema_version !== HANDOFF_SCHEMA) errors.push('unsupported schema_version');
  if (input.agent_id !== 'gemini') errors.push('agent_id must be gemini');
  if (input.repository !== ALLOWED_REPOSITORY) errors.push('repository not allowlisted');
  if (typeof input.mission_id !== 'string' ||
      !/^MCF-[A-Z0-9-]{8,110}$/.test(input.mission_id))
    errors.push('invalid mission_id');
  if (typeof input.base_sha !== 'string' || !SHA40.test(input.base_sha))
    errors.push('base_sha must be 40 hex characters');
  if (typeof input.branch !== 'string' || !BRANCH.test(input.branch) ||
      input.branch.includes('..') || input.branch.endsWith('.lock'))
    errors.push('branch outside isolated Gemini namespace');
  if (typeof input.path !== 'string' || !TARGET_PATH.test(input.path) ||
      input.path.includes('..') || input.path.includes('//'))
    errors.push('path outside Gemini documentation namespace');
  if (typeof input.content !== 'string' || input.content.length < 30 ||
      Buffer.byteLength(input.content, 'utf8') > 64 * 1024 ||
      input.content.includes('\0'))
    errors.push('content must be nonempty UTF-8 text below 64 KiB');
  else if (SENSITIVE.some((re) => re.test(input.content)))
    errors.push('content appears to include a credential');
  if (typeof input.source_url !== 'string' || !SOURCE_URL.test(input.source_url))
    errors.push('source_url must point to a Google Docs document');
  if (typeof input.source_revision !== 'string' ||
      !/^[A-Za-z0-9_-]{15,220}$/.test(input.source_revision))
    errors.push('source_revision missing or malformed');
  if (typeof input.pr_title !== 'string' || input.pr_title.length < 12 ||
      input.pr_title.length > 125 || /[\r\n]/.test(input.pr_title))
    errors.push('pr_title invalid');
  if (typeof input.pr_body !== 'string' || input.pr_body.length < 15 ||
      input.pr_body.length > 5000)
    errors.push('pr_body invalid');
  return { ok: errors.length === 0, errors };
}

export function proposalDigest(manifest) {
  const result = validateHandoff(manifest);
  if (!result.ok) throw new Error('INVALID_HANDOFF: ' + result.errors.join('; '));
  return createHash('sha256').update(
    JSON.stringify(FIELDS.map((field) => [field, manifest[field]])), 'utf8'
  ).digest('hex');
}

export class GithubApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'GithubApiError';
    this.status = status;
  }
}

/**
 * Authentication is delegated to the local GitHub CLI keyring.
 * Credentials are never passed to Gemini, stored in the proposal, or logged.
 */
export async function githubCli(method, endpoint, payload = undefined) {
  if (!['GET', 'POST', 'PUT'].includes(method) ||
      !/^\/repos\/leon337\/mcf-parallel-chat\//.test(endpoint)) {
    throw new Error('API operation outside allowlist');
  }
  const args = ['api', endpoint, '--method', method];
  if (payload !== undefined) args.push('--input', '-');
  const p = spawnSync('gh', args, {
    encoding: 'utf8',
    input: payload === undefined ? undefined : JSON.stringify(payload),
    env: { ...process.env, GH_PROMPT_DISABLED: '1' },
    maxBuffer: 2 * 1024 * 1024,
    timeout: 30000
  });
  if (p.error || p.status !== 0) {
    const message = (p.stderr || p.error?.message || 'GitHub CLI failure')
      .replace(/\b(?:gh[pousr]_|github_pat_)[A-Za-z0-9_]{15,}\b/g, '[redacted]')
      .slice(0, 400);
    const found = message.match(/\b(?:HTTP|status)\s*(401|403|404|409|422)\b/i);
    throw new GithubApiError('GitHub API failure: ' + message, found ? Number(found[1]) : 0);
  }
  try {
    return JSON.parse(p.stdout);
  } catch {
    throw new GithubApiError('GitHub API returned invalid JSON');
  }
}

const prefix = '/repos/' + ALLOWED_REPOSITORY;
async function optional(call) {
  try {
    return await call();
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
}

async function inspect(manifest, api) {
  const baseRef = await api('GET', prefix + '/git/ref/heads/main');
  const liveBase = baseRef?.object?.sha;
  if (liveBase !== manifest.base_sha)
    throw new Error('STALE_BASE: main SHA differs from manifest; require reconciliation');
  const branch = await optional(() =>
    api('GET', prefix + '/git/ref/heads/' + manifest.branch));
  const existing = branch ? await optional(() =>
    api('GET', prefix + '/contents/' + manifest.path +
      '?ref=' + encodeURIComponent(manifest.branch))) : null;
  if (existing && existing.type !== 'file')
    throw new Error('CONFLICT: target path is not a file');
  if (existing) {
    if (typeof existing.content !== 'string' || existing.encoding !== 'base64')
      throw new Error('CONFLICT: existing file cannot be verified');
    const current = Buffer.from(existing.content.replace(/\s/g, ''), 'base64').toString('utf8');
    if (current !== manifest.content) throw new Error('CONFLICT: existing file differs');
  }
  if (branch) {
    const comparison = await api('GET', prefix + '/compare/' +
      manifest.base_sha + '...' + manifest.branch);
    const files = comparison?.files || [];
    if (comparison.behind_by !== 0 ||
        files.some((file) => file.filename !== manifest.path) ||
        (branch.object?.sha !== manifest.base_sha && !existing))
      throw new Error('BRANCH_CONFLICT: branch contains unexpected changes');
  }
  return { live_base_sha: liveBase, branch_exists: Boolean(branch), file_exists: Boolean(existing) };
}

export async function prepareHandoff(manifest, api = githubCli) {
  const digest = proposalDigest(manifest);
  const state = await inspect(manifest, api);
  return {
    schema_version: HANDOFF_SCHEMA,
    decision: 'PREPARED_NOT_PUBLISHED',
    manifest_digest: digest,
    mission_id: manifest.mission_id,
    author_agent: 'gemini',
    publisher: 'MCF/authorized GitHub identity',
    repository: manifest.repository,
    branch: manifest.branch,
    path: manifest.path,
    source_url: manifest.source_url,
    source_revision: manifest.source_revision,
    ...state,
    requires: 'separate explicit review/approval of manifest digest before apply'
  };
}

export async function applyHandoff(manifest, approvedDigest, api = githubCli) {
  const digest = proposalDigest(manifest);
  if (typeof approvedDigest !== 'string' || approvedDigest !== digest)
    throw new Error('HUMAN_GATE: approval digest missing or mismatched');
  const state = await inspect(manifest, api);
  if (!state.branch_exists) {
    await api('POST', prefix + '/git/refs', {
      ref: 'refs/heads/' + manifest.branch,
      sha: manifest.base_sha
    });
  }
  let fileResult = null;
  if (!state.file_exists) {
    fileResult = await api('PUT', prefix + '/contents/' + manifest.path, {
      message: 'docs(gemini): publish approved Drive handoff ' + manifest.mission_id,
      content: Buffer.from(manifest.content, 'utf8').toString('base64'),
      branch: manifest.branch
    });
  }
  const prs = await api('GET', prefix + '/pulls?state=open&head=leon337%3A' +
    encodeURIComponent(manifest.branch) + '&base=main');
  if (!Array.isArray(prs)) throw new Error('GitHub PR lookup response invalid');
  let pr = prs.find((item) => item.head?.ref === manifest.branch);
  if (pr && !pr.draft)
    throw new Error('NON_DRAFT_PR: existing PR not draft; halt');
  if (!pr) {
    const provenance = '\n\n---\nMCF Gemini GitHub gateway; source: ' +
      manifest.source_url + '; source revision: ' + manifest.source_revision +
      '; manifest SHA-256: ' + digest +
      '. Author: Gemini; GitHub publisher: authenticated MCF operator.' +
      ' No merge/deploy authorized.';
    pr = await api('POST', prefix + '/pulls', {
      title: manifest.pr_title,
      body: manifest.pr_body + provenance,
      head: manifest.branch,
      base: 'main',
      draft: true,
      maintainer_can_modify: false
    });
  }
  if (!pr?.draft || pr?.state !== 'open')
    throw new Error('GitHub did not confirm an open draft PR');
  const verified = await inspect(manifest, api);
  if (!verified.branch_exists || !verified.file_exists)
    throw new Error('POSTCONDITION_FAILED: branch or file missing');
  const comparison = await api('GET', prefix + '/compare/' +
    manifest.base_sha + '...' + manifest.branch);
  if ((comparison.files || []).length !== 1 ||
      comparison.files[0].filename !== manifest.path ||
      comparison.behind_by !== 0)
    throw new Error('POSTCONDITION_FAILED: unexpected GitHub diff');
  return {
    decision: 'DRAFT_PR_PUBLISHED',
    mission_id: manifest.mission_id,
    author_agent: 'gemini',
    publisher: 'MCF/authorized GitHub identity',
    manifest_digest: digest,
    source_url: manifest.source_url,
    repository: manifest.repository,
    branch: manifest.branch,
    path: manifest.path,
    commit_sha: fileResult?.commit?.sha || comparison?.commits?.at(-1)?.sha || null,
    pr_number: pr.number,
    pr_url: pr.html_url,
    draft: true,
    main_untouched: true,
    verified: true
  };
}
