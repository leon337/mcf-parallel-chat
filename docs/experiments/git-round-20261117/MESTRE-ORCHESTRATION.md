# Rodada Git/GitHub multiagente — MESTRE

**Missão:** MCF-GIT-GITHUB-COLLAB-20261117-001
**Data:** 2026-11-17
**Responsável:** MESTRE (orquestração)
**Autoridade humana:** LEANDRO
**Repositório de trabalho:** `leon337/mcf-parallel-chat` (privado)
**Repositório canônico de governança:** `leon337/multiagent-collaboration-framework`

## Objetivo e limites

Verificar colaboração real de três agentes sobre um projeto Git/GitHub por meio de branches isoladas, commits rastreáveis, validação de artefatos e pull requests em rascunho. Não alterar `main`, não publicar produção, não apagar branches, não modificar segredos e não contornar gates.

## Responsabilidades e isolamento

| Agente | Branch exclusiva | Entrega |
| --- | --- | --- |
| MESTRE | `experiment/mcf-git-round-20261117-mestre` | Este plano e reconciliação das evidências |
| ChatGPT (Dual Browser) | `experiment/mcf-git-round-20261117-chatgpt` | Função de validação de contribuição de agentes e testes unitários |
| Gemini (Dual Browser) | `experiment/mcf-git-round-20261117-gemini` | Plano independente de QA Git/GitHub e critérios de aceite |

## Contrato de entrega

Cada agente deve informar o SHA do commit, URL da branch e, quando permitido, URL do pull request **draft**. A observação de uma resposta no chat não comprova sucesso: a verificação final consulta GitHub live, arquivos, histórico e diffs.

## Critérios de aceite

1. Três branches existem remotamente com commits distintos, originados em `main` e sem interferir na branch padrão.
2. Três entregas são atribuíveis aos responsáveis e o diff de cada branch contém somente o escopo declarado.
3. O trabalho do ChatGPT é testado sem credenciais, com Node.js e dependências padrão.
4. Revisões e gates necessários são explícitos; não realizar merge nem deploy.
5. Falhas de autenticação, timeout, concorrência ou conflitos são documentados, nunca mascarados.

## Handoff

O MESTRE reconcilia branch, commit, arquivo, teste e PR; GEMINI fornece QA independente; ChatGPT corrige problemas em sua branch. Não executar alterações destrutivas nem promover código sem gate humano aplicável.

**Marcador de evidência:** `MESTRE_GIT_ROUND_OK_20261117`

_Nota: este registro é um experimento isolado; não é um contrato de produção._
