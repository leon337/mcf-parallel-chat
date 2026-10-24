// Deterministic Gemini tab selection in the local MCF Cockpit.
// Account-specific /u/N/app tabs take precedence over an unscoped /app tab.
// Ambiguous authenticated profiles fail closed; never choose arbitrarily.
export function geminiTargets(targets) {
  if (!Array.isArray(targets)) return [];
  return targets.filter(t => t?.type === 'page' && typeof t.webSocketDebuggerUrl === 'string')
    .map(target => {
      try {
        const u = new URL(target.url);
        if (u.protocol !== 'https:' || u.hostname !== 'gemini.google.com') return null;
        const match = u.pathname.match(/^\/u\/(\d+)\/app(?:\/.*)?$/);
        const generic = u.pathname === '/app' || u.pathname.startsWith('/app/');
        if (!match && !generic) return null;
        return { target, profile: match ? match[1] : 'default', scoped: Boolean(match) };
      } catch { return null; }
    }).filter(Boolean);
}

export function selectGeminiTarget(targets, profile = 'auto') {
  const entries = geminiTargets(targets);
  let candidates = entries;
  if (profile !== 'auto') {
    if (typeof profile !== 'string' || !/^(?:default|\d+)$/.test(profile)) {
      throw new Error('Perfil Gemini inválido. Use auto, default ou o número da conta.');
    }
    candidates = entries.filter(e => e.profile === profile);
    if (candidates.length !== 1) {
      throw new Error('O perfil Gemini solicitado não está aberto de forma única no Cockpit.');
    }
    return candidates[0];
  }
  const scoped = entries.filter(e => e.scoped);
  if (scoped.length === 1) return scoped[0];
  if (scoped.length > 1) {
    throw new Error('Há várias contas Gemini. Configure MCF_GEMINI_PROFILE para escolher uma.');
  }
  if (entries.length === 1) return entries[0];
  if (entries.length === 0) throw new Error('Nenhuma sessão Gemini utilizável foi encontrada no Cockpit.');
  throw new Error('Há múltiplas páginas Gemini sem perfil explícito; não é seguro selecionar uma.');
}
