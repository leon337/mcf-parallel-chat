# MCF Parallel Chat — MVP 0.2.1

A v0.2.1 corrige múltiplas páginas Gemini no Cockpit: seleciona deterministicamente a única sessão com perfil numerado (`/u/N/app`) quando existir junto da página genérica, ativa a janela selecionada pelo Chromium (`Page.bringToFront`) antes da digitação e não envia nada caso várias contas distintas tornem a escolha ambígua. A variável opcional `MCF_GEMINI_PROFILE` permite selecionar `default` ou um índice numérico quando necessário. O endpoint `/api/status` informa `geminiProfile` e só apresenta Gemini disponível quando uma sessão válida é selecionável.

**Repositório privado:** https://github.com/leon337/mcf-parallel-chat

A v0.2 adiciona envelopes de proveniência com IDs correlacionados entre frontend e backend, registro local somente de metadados em `.mcf-data/events.jsonl`, exportação explícita do histórico e diagnóstico aprimorado para envio ao Gemini quando a janela muda de tamanho. São identificações técnicas, **não assinaturas criptográficas**. O motor local continua sendo um mecanismo determinístico, não GPT-6.

Chatbot experimental executado localmente com duas respostas independentes:

- **Motor local**: regras determinísticas em Node.js. Rápido, sem acesso a modelos de IA e identificado como tal.
- **Google Gemini**: usa uma sessão Gemini previamente autenticada em uma janela auxiliar do **MCF Dual Browser Cockpit**, via Chrome DevTools Protocol na porta local 9334.

A interface executa as duas solicitações **concorrentemente** e apresenta respostas em cartões separados. Sem custos de API e sem alteração do repositório oficial MCF.

## Acessar

Projeto: `/home/leo/agent-sandbox/projects/mcf-parallel-chat`

Servidor: `http://127.0.0.1:48721/`

Já aberto como janela auxiliar do MCF Dual Browser Cockpit no notebook.

Para iniciar manualmente caso o processo pare:

```bash
cd /home/leo/agent-sandbox/projects/mcf-parallel-chat
npm start
```

Requisitos: Node.js 22.12+; Dual Browser Cockpit com Gemini autenticado e depuração local ativa em `127.0.0.1:9334`. A aba Gemini deve permanecer aberta. O aplicativo não usa API do Google nem chave paga.

## Funcionalidades

- Chat com histórico em memória na aba e **exportação JSON sob comando do usuário**; observabilidade persistente grava apenas metadados, sem prompts;
- Solicitações simultâneas com `Promise.allSettled` no navegador;
- Tempo de resposta, identificação da origem e falhas independentes;
- Limite de 2000 caracteres por prompt, rejeição de requisições grandes;
- Autenticação do Google existente somente dentro do Cockpit; nenhum token/cookie extraído;
- Apenas vinculado a `127.0.0.1`; exige origem local correspondente para requisições de navegador;
- Integração Gemini serializada por processo, com timeout e salvaguarda de rascunho;
- O texto de IA vai à UI via `textContent`, sem executar HTML remoto.

## Testes

```bash
npm run check
npm test
# testes reais, que enviam mensagens ao Gemini:
npm run test:live
npm run test:browser
```

Os dois últimos enviam mensagens reais à conversa Gemini vinculada à conta atualmente autenticada, portanto use somente quando essa interação for desejada.

## Arquitetura

```text
                         ┌─ /api/local  ─→ Regras locais ─→ resposta imediata
Usuário → Interface Web ─┤
                         └─ /api/gemini ─→ Adaptador CDP
                                                ↓
                                     Gemini no Electron/Cockpit
                                                ↓
                                         resposta assíncrona
```

## Limitações explícitas

1. São **um motor de regras e um modelo generativo**, não dois LLMs. O rótulo MESTRE refere-se ao orquestrador humano/assistido no projeto, não a uma execução automática do GPT-6 no backend.
2. O Gemini é acessado pela interface web: alterações de DOM, login, limites de conta, CAPTCHA ou bloqueio do provedor podem interromper a integração.
3. Exige depuração local do Cockpit; não deve ser exposta na rede.
4. MVP sem banco, integração com GitHub, acesso a dados sensíveis, agente autônomo ou ações externas não autorizadas.
5. Resposta de Gemini estabilizada por amostragem do DOM: pode retornar texto parcial em gerações longas. Para produção, substituir por conector oficialmente suportado.
6. Se o Gemini estiver indisponível, apenas o cartão Gemini falha, preservando a resposta local.

## Segurança

Não envie segredos, dados bancários ou informações sensíveis. Cada pergunta é enviada à sessão Gemini do Google para processamento remoto. Nada é enviado automaticamente sem ação do usuário na interface. O servidor local não salva o histórico.

Não modificar o código do Cockpit sem autorização adicional.

## Revisão externa

Gemini foi consultado durante esta missão como revisor independente. Apontou riscos de mudanças no DOM, concorrência da UI e expiração de sessão; recomendou indicadores distintos por motor. Consultar `docs/MCF-MISSION.md` para evidência.
