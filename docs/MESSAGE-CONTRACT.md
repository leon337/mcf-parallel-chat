# Contrato de Mensagens — MCF Parallel Chat

Versão proposta: `mcf-attribution-v1`. Estado: **atribuição visual em implementação**, não uma assinatura criptográfica de identidade.

## Identidade e autoridade

- `LEANDRO` — `human`: autoridade final, linguagem natural, decide gates.
- `MESTRE` — `orchestrator`: coordenação e análise, apenas quando uma instância realmente o emitir.
- `GEMINI-WEB` — `external-model`: Gemini por navegador do Cockpit.
- `MCF-LOCAL-RULES` — `deterministic-engine`: mecanismo de regras, não é um LLM.

Nunca rotular `MCF-LOCAL-RULES` como GPT-6 ou MESTRE.

## Metadados por mensagem

- `schema`: versão do envelope
- `session_id`: UUID v4 da sessão de interface
- `turn_id`: UUID v4 da pergunta e das respectivas respostas
- `message_id`: UUID v4 da mensagem específica
- `parent_message_id`: identificador da pergunta humana que originou a resposta
- `timestamp`: ISO 8601 com fuso explícito
- `actor_id`: identificador atribuído pelo sistema, não pelo texto do usuário
- `role`: papel técnico
- `provider`: origem de execução
- `status`: pending/completed/error
- `latency_ms`: tempo observado
- `signature_type`: `attribution-only`, até que exista autenticação e assinatura real

**Importante**: campos no frontend oferecem identificabilidade visual e correlação local, mas não impedem `actor spoofing`. A confiança entre múltiplos hosts exige emissão e validação do envelope no backend. Não chamar texto de rodapé de assinatura criptográfica.

## Formato recomendado para agentes

```
[MCF_AGENT_MESSAGE v1]
actor_id: GEMINI-WEB
role: peer_reviewer
provider: gemini-cockpit-web
turn_id: UUID
parent_message_id: UUID
scope: architecture_review
status: completed
---
Análise técnica:
Hipótese:
Evidência:
Risco:
Recomendação:
Critério de aceite:
Próximo responsável:
```

LEANDRO continua escrevendo em linguagem natural. Agentes devem usar terminologia técnica precisa e contextualizar conceitos na entrega.

## Glossário mínimo

- **Proveniência (provenance)**: origem declarada e verificável dos dados ou da resposta.
- **Trace ID**: identificador de um fluxo completo de execução.
- **Turn ID**: correlação de uma pergunta com todas as respostas derivadas.
- **Span**: unidade de trabalho instrumentada, usada para medir latência e erros.
- **Envelopamento (message envelope)**: separação entre conteúdo e metadados de roteamento.
- **Actor spoofing**: tentativa de falsificar a autoria de um agente.
- **Trace poisoning**: envio de metadados falsos para manipular observabilidade.
- **Append-only log**: registro sequencial sem atualização in-place.
- **CI**: execução automática de testes por commit/push.
- **SSE**: Server-Sent Events, stream unidirecional do servidor para o cliente.
- **AsyncIterable**: contrato assíncrono iterável para receber chunks, eventos e conclusão.
- **Fallback**: degradação controlada quando um provedor falha.
- **Portabilidade**: executar o software em ambiente diferente com dependências documentadas.

## Política de observabilidade

Registrar apenas IDs, timestamps, origem, estado e métricas; não registrar corpo da mensagem, tokens, cookies ou headers de autenticação sem finalidade explícita e proteção apropriada.
A proveniência exibida ao usuário não substitui autenticação, verificação criptográfica ou auditoria de integridade.

## Portabilidade e resiliência

Clonar e executar sem Gemini deve preservar o motor local. O adaptador Gemini Web é dependente de uma sessão autenticada e porta de depuração local; não funciona automaticamente em máquinas limpas. Não habilitar porta CDP em IP público.

## Ações pendentes da v0.2

- Validação do envelope no backend com IDs correlacionados e assinatura autenticada quando necessário.
- Exportação explícita de histórico (opt-in) sem inclusão de conteúdo privado no Git.
- Eventos assíncronos `AsyncIterable` + SSE.
- Contrato de provedores `local`, `gemini-web`, `gemini-api` opcional.
- CI em GitHub Actions após criação do repositório remoto.
