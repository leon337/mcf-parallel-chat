# MCF — Missão local de prototipação

mission_id: MCF-PARALLEL-CHAT-MVP-20261024
phase_id: MVP-001
objective: Construir chatbot local de dois fluxos concorrentes com participação efetiva do Gemini.
requested_by: LEANDRO
authority: LEANDRO
orchestrator: MESTRE
risk_class: B (implementação reversível em sandbox)
authorization: Solicitação explícita de desenvolver chatbot em paralelismo com Gemini.
scope: Pasta local `/home/leo/agent-sandbox/projects/mcf-parallel-chat`; Gemini do Cockpit com sessão autenticada; protótipo no loopback.
out_of_scope: Push GitHub, deploy remoto, publicação, APIs pagas, alterações em projetos existentes, leitura de segredos.
acceptance:
  - Interface executável no Cockpit.
  - Duas solicitações disparadas concorrentemente.
  - Resposta local independente.
  - Resposta real do Gemini.
  - Testes de contrato e UI E2E.
  - Falhas isoladas e controles mínimos de segurança.

## Sequência e evidência

1. MESTRE recuperou protocolo operacional canônico `docs/protocols/MCF-PROTOCOLO-OPERACIONAL-UNIFICADO-DE-AGENTES.md` no GitHub do MCF.
2. Identificados Node v22, ausência de Ollama, navegador Gemini autenticado no Chromium do Cockpit `notebook` com CDP local 9334.
3. Criado adaptador `gemini-client.mjs`. Consulta de **revisão independente** enviada ao Gemini:
   "Estamos construindo um MVP de chatbot paralelo: mecanismo local determinístico e Gemini via interface web do Cockpit, sem API paga. Atue como REVISOR INDEPENDENTE: sugira 3 riscos de segurança/concorrência prioritários, 3 testes de aceite e uma melhoria de UX..."
   Retorno confirmado: automação suscetível a CAPTCHA e mudanças de DOM, race conditions UI, sessão expirada; badges independentes por motor.
4. MESTRE implementou módulos locais `local-engine.mjs`, `server.mjs`, `public/`, testes de contrato `test/app.test.mjs`, integração real e E2E.
5. Validação automática final: `npm run check && npm test` → **7/7 PASS**, incluindo falha do Gemini simulada, preservação de resposta local e validação de mensagens.
6. Integração real com Gemini via API local:
   - motor local HTTP 200, 203ms;
   - Gemini HTTP 200, 8576ms;
   - ambos `ok:true`, pedidos lançados em paralelo.
7. E2E de interface pelo Chromium/Electron:
   - input submetido pelo frontend local;
   - 1 turno mostrado e 2 cartões recebendo resposta;
   - badge local `1 ms`, badge Gemini `21120 ms`;
   - campo de envio reabilitado, sem interferência do ChatGPT à esquerda.
8. Revisão manual de código e risco: não há conexão remota de API paga; o alvo CDP é filtrado por domínio Gemini; respostas renderizadas com `textContent`; gravação de histórico não implementada.

## Pendente / evolução possível

- Habilitar mock do CDP nos testes automatizados para testar timeout, reset do navegador e sessão expirada sem enviar mensagens ao Gemini.
- Integrar um segundo LLM genuíno (local, oficial e sem custo) caso recursos e autorização permitam.
- Navegador Cockpit: mecanismo de abas internas ainda não existe, usamos janela auxiliar nativa do mesmo Electron.
- Obter revisão de usuário sobre UX. Nenhum deploy externo está autorizado.
