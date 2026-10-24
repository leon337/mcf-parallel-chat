// Motor local determinístico e transparente. Não se apresenta como modelo generativo.
const topics = [
  { re: /(?:arquitetura|architecture|microservic|monolit)/i,
    title: 'Arquitetura de software',
    answer: 'Comece pelo problema e requisitos não funcionais. Para um MVP, prefira um monólito modular com fronteiras explícitas, HTTP local, estado mínimo e testes de contrato. Separe interface, domínio, infraestrutura e integrações externas. Evolua para serviços distribuídos apenas quando houver necessidade comprovada.',
    next: 'Liste usuários, fluxos principais, dados e restrições de segurança.' },
  { re: /(?:seguran|security|senha|token|autentic|auth|vulnerabil)/i,
    title: 'Segurança e autenticação',
    answer: 'Use validação de entrada, menor privilégio, autenticação por contexto, armazenamento seguro de credenciais, limites de tamanho, timeout e logs sem segredos. Para automação de navegador, limite o alvo, exija aprovação em ações de escrita e isole os perfis.',
    next: 'Modele as ameaças antes de adicionar permissões de escrita.' },
  { re: /(?:teste|testar|qualidade|bug|erro|debug)/i,
    title: 'Qualidade e testes',
    answer: 'Crie uma pirâmide enxuta: testes unitários do domínio, testes de integração para as rotas e um smoke test E2E do fluxo principal. Registre a evidência de cada execução, incluindo falhas, e não confunda interface renderizada com funcionalidade validada.',
    next: 'Escreva um caso positivo, um caso de erro e um caso de concorrência.' },
  { re: /(?:python|javascript|typescript|node|código|codar|programa)/i,
    title: 'Implementação',
    answer: 'Defina contrato de entrada/saída, extraia regras de negócio para módulos testáveis e evite I/O escondido. Use validação explícita, tratamento de exceções, lint/format e testes automatizados. Mantenha as integrações externas atrás de adapters.',
    next: 'Envie a linguagem, o comportamento esperado e um exemplo de entrada.' },
  { re: /(?:chatbot|bot|inteligência artificial|\bia\b|gemini|agente)/i,
    title: 'Chatbot e integração',
    answer: 'A arquitetura básica possui UI de conversação, orquestrador, motor local, adaptador de modelo e validação de resultado. Dispare provedores de forma concorrente quando forem independentes. Exiba a origem e a latência de cada resposta. Tenha fallback claro, sem fingir que uma regra determinística é IA.',
    next: 'Escolha um domínio de uso, como suporte, estudo ou automação.' },
  { re: /(?:ola\b|olá\b|bom dia|boa tarde|boa noite|oi\b|hello\b)/i,
    title: 'Saudação',
    answer: 'Olá! Sou o motor local do MCF Parallel Chat. Posso ajudar com arquitetura, segurança, programação, testes e planejamento. Minha saída é baseada em regras transparentes; o Gemini responde independentemente no outro fluxo.',
    next: 'Descreva um problema de software concreto.' },
];
export function localReply(message) {
  const start = performance.now();
  const input = String(message || '').trim();
  if (!input || input.length > 2000) throw new RangeError('Mensagem deve ter entre 1 e 2000 caracteres.');
  const found = topics.find(t => t.re.test(input));
  const chosen = found || {
    title: 'Estruturação do problema',
    answer: 'Para construir uma resposta confiável, preciso de contexto: objetivo, público, comportamento esperado, restrições e critério de sucesso. Meu mecanismo local é baseado em regras e não deve inventar conhecimento específico que não possua.',
    next: 'Formule o objetivo em uma frase e descreva um exemplo de uso.',
  };
  return {
    source: 'local-rules',
    title: chosen.title,
    reply: chosen.answer + '\n\nPróximo passo: ' + chosen.next,
    latencyMs: Math.max(0, Math.round(performance.now() - start)),
  };
}
