# Execução em outro computador — MCF Parallel Chat

## Requisitos mínimos
- Linux/macOS/Windows com **Node.js 22.12+**.
- Git e acesso ao repositório remoto.
- Nenhum pacote npm externo obrigatório na v0.1.
- Sem chave de API ou conexão com Gemini, o motor local funciona; apenas Gemini ficará offline.

## Desenvolvimento portátil
Após a publicação do repositório:

```bash
git clone git@github.com:leon337/mcf-parallel-chat.git
cd mcf-parallel-chat
npm run check
node server.mjs
```

Abra `http://127.0.0.1:48721/` no **próprio computador**. Para executar em outra porta local use `PORT=48722 node server.mjs` (Linux/macOS).

Execute `npm test` com o servidor já em execução na porta padrão 48721.

## Dependência especial do Gemini

O projeto **não é autossuficiente para Gemini**: requer uma instância autorizada do MCF Dual Browser Cockpit com sessão Gemini aberta e CDP local. Atualmente o padrão aponta para `127.0.0.1:9334`. Pode ser alterado por `MCF_GEMINI_DEBUG_URL`.

Nunca publique o Chrome DevTools Protocol na rede externa; o endpoint de depuração pode permitir controle integral do navegador. Para um servidor remoto, use futuro adaptador de API oficial (que ainda não foi implementado), com credenciais em cofre e uso sob autorização.

## Persistência e observabilidade

A interface atual mantém o histórico apenas em memória. Na versão com envelopes de autoria, use o botão **Exportar conversa JSON** se desejar guardar uma cópia. O conteúdo exportado pode incluir informações privadas; não comite no Git.

Atribuição visual não equivale a verificação de assinatura digital. Para multi-host, validar identidade do agente e correlação no backend.

## Publicação GitHub

O repositório local já está inicializado. **O remoto ainda precisa ser criado e o primeiro push confirmado.** A operação automatizada de criação foi impedida por uma proteção de segurança da ferramenta.

Na máquina autorizada, o responsável humano pode concluir localmente:

```bash
cd /home/leo/agent-sandbox/projects/mcf-parallel-chat
gh repo create leon337/mcf-parallel-chat --private --source=. --remote=origin --push
```

Se o repositório já existir, configure o remoto com `git remote add origin git@github.com:leon337/mcf-parallel-chat.git` e use `git push -u origin main`. Verifique no GitHub o branch e o commit antes de considerar backup concluído.

## Segurança de publicação

Verifique se o Git não inclui: `.env`, tokens, cookies, dumps do navegador, capturas com dados privados ou logs brutos de mensagens. O `.gitignore` exclui arquivos `.env` e logs; dados privados exportados devem ficar fora do repositório.
