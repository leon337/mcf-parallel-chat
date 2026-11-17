/**
 * Validate a single MCF agent contribution envelope.
 * Pure function: no I/O, dependencies, mutation, or external state.
 *
 * @param {unknown} contribution
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateAgentContribution(contribution) {
  if (contribution === null || typeof contribution !== 'object' || Array.isArray(contribution)) {
    return { valid: false, errors: ['contribution must be an object'] };
  }

  const errors = [];
  const identifierPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

  for (const field of ['mission_id', 'agent_id']) {
    if (typeof contribution[field] !== 'string' || !identifierPattern.test(contribution[field])) {
      errors.push(field + ' must be a non-empty identifier (letters, digits, ., _ or -)');
    }
  }

  const branch = contribution.branch;
  const invalidBranch =
    typeof branch !== 'string' ||
    branch.length === 0 ||
    branch === '@' ||
    branch.startsWith('-') ||
    branch.endsWith('.') ||
    branch.includes('..') ||
    branch.includes('//') ||
    branch.includes('@{') ||
    /[\u0000-\u0020\u007f~^:?*\[\\]/.test(branch) ||
    branch.split('/').some((part) => !part || part.startsWith('.') || part.endsWith('.lock'));

  if (invalidBranch) {
    errors.push('branch must be a valid Git branch name');
  }

  if (typeof contribution.commit_sha !== 'string' || !/^[0-9a-fA-F]{40}$/.test(contribution.commit_sha)) {
    errors.push('commit_sha must be exactly 40 hexadecimal characters');
  }

  let validEvidenceUrl = false;
  if (typeof contribution.evidence_url === 'string' &&
      contribution.evidence_url.startsWith('https://') &&
      contribution.evidence_url === contribution.evidence_url.trim()) {
    try {
      const parsed = new URL(contribution.evidence_url);
      validEvidenceUrl = parsed.protocol === 'https:' && Boolean(parsed.hostname) &&
        !parsed.username && !parsed.password;
    } catch {
      // An invalid URL is reported through the same field-level error.
    }
  }

  if (!validEvidenceUrl) {
    errors.push('evidence_url must be an absolute HTTPS URL without credentials');
  }

  return { valid: errors.length === 0, errors };
}
