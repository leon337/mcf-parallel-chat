# Integração governada Gemini → Google Drive → GitHub

Missão: MCF-GEMINI-GITHUB-INTEGRATION-20261117-001
Estado: **EXPERIMENTAL — laboratório privado, sem merge/deploy**
Autoridade: LEANDRO. Orquestração: MESTRE. Agente autor: Gemini.

## Motivação: limite confirmado do Gemini Web

A integração GitHub nativa do Gemini Web permite importar e consultar código, mas não escrever no repositório.
Fonte: https://support.google.com/gemini/answer/16176929

Apps MCP personalizados do Gemini Web têm exigências de disponibilidade por país/conta. Não assumir que estejam disponíveis para esta conta no Brasil.
Fonte: https://support.google.com/gemini/answer/17209137

A conta do Gemini (via Workspace do Dual Browser) já escreveu Google Docs dentro da pasta operacional Potiguar, mas não tem sessão GitHub autenticada. A integração não solicita nem compartilha senhas ou tokens GitHub com o Gemini.

## Arquitetura

1. Gemini produz um **Google Docs autoral** na pasta compartilhada da conta Potiguar.
2. MESTRE consulta o documento via conexão autenticada Google Drive, confere ID, parentId, revisionId, conteúdo e autoria declarada.
3. MESTRE exporta um **manifesto JSON imutável** com referência à revisão lida e com destino restrito a uma branch isolada.
4. O gateway local executa primeiro o modo **prepare** (somente leitura do GitHub e SHA-256 de todos os campos).
5. Após verificação humana/delegação expressa, MESTRE executa **apply** com o SHA-256 do manifesto aprovado.
6. O gateway utiliza o GitHub CLI autenticado somente **no computador autorizado**, cria branch de experimento, grava **um novo arquivo** e abre PR **Draft**.
7. Releitura do arquivo, branch, diff e PR no GitHub. Registra URL, commit SHA e limitações.

### Limites técnicos

- Este gateway **não oferece uma API pública**, não inicia um serviço de rede e não expõe credenciais ao Gemini.
- É um **adapter de handoff** (o Gemini escreve no Drive; MESTRE publica). Não equivale a escrita direta do navegador Gemini.
- A integração não faz polling do Google Drive: para cada missão o orquestrador ainda precisa exportar o documento verificado para o manifesto. A Bridge Google local instalada tem escopo de metadados **read-only**, não oferece download de conteúdo nem eventos de escrita.
- O identificador do documento/revisionId do manifesto é provenance declarada. **É o MESTRE que deve confirmar os metadados pelo Google Drive**, antes do prepare. A ferramenta de linha de comando não consegue comprovar autoria humana ou dos modelos por si só.
- O hash do manifesto evita alteração acidental entre revisão e aplicação; **não é uma assinatura criptográfica da autoridade humana**. O gateway não implementa integralmente HDF/PermissionEngine/MissionRuntime; integrar esses componentes é evolução futura.
- Projeto autorizado nesta versão: **leon337/mcf-parallel-chat**, privado. Outras contas ou repositórios falham em modo fechado.
- Branch: apenas experiment/mcf-gemini-github-* (sem escrita na main).
- Arquivo: apenas novo Markdown docs/experiments/gemini-github-bridge/GEMINI-*.md.
- Sem alteração de arquivos preexistentes, merges, deploys, push forçado, rotação de tokens ou deleção de branches/PRs.
- GitHub API é invocada via gh com credencial preexistente na keyring, sem gravar token em arquivo ou log.
- O GitHub registrará o usuário autorizado que publicou como ator GitHub; **Gemini permanece o autor editorial** explicitamente no documento e no PR.
- Conflito, divergência de SHA da main, branch com outros arquivos, autenticação falha ou PR não Draft bloqueiam execução.
- Reexecução do mesmo manifesto é idempotente quanto ao arquivo e PR (sem duplicá-los).
- Executar com a identidade do operador local autorizado; nunca expor uma chamada apply irrestrita a um agente não confiável.

## Como operar

Arquivo de entrada: um JSON com os campos schema_version, mission_id, agent_id, repository, base_sha, branch, path, content, source_url, source_revision, pr_title, pr_body.

Comandos a partir da raiz do projeto:

~~~bash
node tools/mcf-gemini-github.mjs prepare .mcf-data/gemini-handoff.json
# Revise o manifesto, diff esperado e SHA-256.
node tools/mcf-gemini-github.mjs apply .mcf-data/gemini-handoff.json --approve-digest=<sha256-aprovado>
~~~

**Atenção:** a chamada apply é uma mutação real no GitHub (branch, commit, PR Draft). Somente use após a aprovação expressa da proposta específica pelos gates aplicáveis.

O diretório .mcf-data/ é ignorado pelo Git, impedindo commit acidental do manifesto exportado. Para registro de evidência, guarde recibos de prepare/apply fora de diretórios publicados.

## Validação

Testes isolados:

~~~bash
node --test test/gemini-github-broker.test.mjs
node --check src/gemini-github-broker.mjs
node --check tools/mcf-gemini-github.mjs
~~~

Os testes validam: isolamento da main, allowlist de repositório, bloqueio de caminhos fora de escopo, payload suspeito, URL de origem, geração de SHA-256, aprovação obrigatória, compare/diff, read-after-write, replay idempotente e erro de autenticação.

A suíte ampla do laboratório tem testes HTTP acoplados à porta 48721. Se outro processo ocupar essa porta, o resultado local pode refletir um servidor diferente do esperado. Para comparação confiável, use o GitHub Actions isolado ou um servidor temporário em namespace/ambiente separado, sem interromper serviços do usuário.

## Saída esperada

PREPARED_NOT_PUBLISHED: hash e escopo declarados; nenhuma mutação GitHub.

DRAFT_PR_PUBLISHED: branch, PR, SHA de commit, revisão Drive de origem, autor editorial Gemini, publicação via conta GitHub do MCF, confirmação de diff e indicação de que a main não foi alterada.

## Limites de conclusão

A existência do PR e CI verde **não** substituem revisão de segurança, gate de LEANDRO quando necessário, aprovação de merge ou deploy. Nenhuma integração automática com produção foi autorizada.

## Recuperação

- Antes do apply: corrigir manifesto e preparar novamente (novo hash).
- Se apply falhar após criar branch: **não excluir automaticamente**. Inspecionar branch e arquivo, reconciliação antes de repetir.
- Se o PR já existir com o mesmo conteúdo e for Draft: replay recupera estado sem duplicar.
- Se houver alterações divergentes: falhar em modo fechado e criar novo manifesto/branch mediante decisão governada.

Referência de governança MCF: https://github.com/leon337/multiagent-collaboration-framework/blob/main/AGENTS.md
