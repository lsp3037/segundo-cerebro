// Formato dos campos jsonb de service_flows e os fluxos iniciais sugeridos.

export type MessageTemplate = { title: string; text: string };
export type Objection = { objection: string; answer: string };

export type FlowContent = {
  steps: string[];
  questions: string[];
  info_to_collect: string[];
  message_templates: MessageTemplate[];
  objections: Objection[];
  next_steps: string[];
};

export function slugify(text: string) {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// Ponto de partida para o Luan ajustar: sem preços, que mudam e ficam no Repositório da Empresa.
export const SUGGESTED_FLOWS: ({ name: string; description: string } & FlowContent)[] = [
  {
    name: "Formatação",
    description: "Reinstalar o Windows com backup dos arquivos e programas essenciais.",
    steps: ["Entender o problema e o uso do PC", "Combinar o backup", "Receber o equipamento", "Formatar e instalar programas", "Testar e entregar"],
    questions: ["O que está acontecendo com o computador?", "Tem arquivos importantes que precisam ser salvos?", "Quais programas você usa no dia a dia?", "Tem a licença do Office ou de outros programas?"],
    info_to_collect: ["Marca e modelo", "Tamanho dos arquivos a salvar", "Lista de programas", "Melhor dia para levar ou buscar"],
    message_templates: [
      { title: "Primeiro contato", text: "Oi! Consigo te ajudar sim. Me conta o que está acontecendo com o computador e qual é o modelo dele?" },
      { title: "Explicar o backup", text: "Antes de formatar eu salvo seus arquivos (fotos, documentos, área de trabalho) e devolvo tudo no lugar depois." },
    ],
    objections: [{ objection: "Vou perder meus arquivos?", answer: "Não. Faço o backup antes e confiro com você o que precisa ser salvo." }],
    next_steps: ["Agendar a retirada ou a entrega", "Abrir a O.S. no Gerenciador"],
  },
  {
    name: "Limpeza e manutenção",
    description: "Limpeza interna, troca de pasta térmica e revisão geral.",
    steps: ["Entender os sintomas (calor, barulho, lentidão)", "Explicar o serviço", "Receber o equipamento", "Limpar e trocar a pasta térmica", "Testar temperatura e entregar"],
    questions: ["O computador está esquentando ou fazendo barulho?", "Desliga sozinho?", "Quando foi a última limpeza?"],
    info_to_collect: ["Marca e modelo", "Notebook ou desktop", "Sintomas"],
    message_templates: [
      { title: "Explicar a limpeza", text: "Com o tempo junta poeira dentro e a pasta térmica resseca, aí ele esquenta e fica lento. Na limpeza eu resolvo isso e já faço uma revisão geral." },
    ],
    objections: [{ objection: "Precisa mesmo?", answer: "Se está esquentando, sim: o calor encurta a vida das peças. É um cuidado que evita um conserto maior." }],
    next_steps: ["Agendar a retirada ou a entrega", "Abrir a O.S. no Gerenciador"],
  },
  {
    name: "Upgrade de SSD e memória",
    description: "Trocar HD por SSD e/ou aumentar a memória RAM.",
    steps: ["Entender o uso e a lentidão", "Verificar compatibilidade do modelo", "Passar o orçamento", "Instalar e migrar o sistema", "Testar e entregar"],
    questions: ["Qual é o modelo exato (etiqueta embaixo do notebook)?", "Para que você usa o computador?", "Quer manter tudo como está ou começar do zero?"],
    info_to_collect: ["Modelo exato", "Memória e armazenamento atuais", "Orçamento disponível"],
    message_templates: [
      { title: "Pedir o modelo", text: "Me manda uma foto da etiqueta embaixo do notebook? Assim eu confiro qual SSD e memória são compatíveis." },
      { title: "Explicar o ganho", text: "Com SSD o computador liga em segundos e os programas abrem bem mais rápido. É o upgrade que mais faz diferença." },
    ],
    objections: [{ objection: "Não é melhor comprar um novo?", answer: "Muitas vezes o upgrade resolve por bem menos. Se não valer a pena para o seu modelo, eu te falo." }],
    next_steps: ["Enviar orçamento", "Encomendar as peças", "Abrir a O.S. no Gerenciador"],
  },
  {
    name: "Diagnóstico",
    description: "Avaliar um defeito antes de passar o orçamento.",
    steps: ["Entender o defeito", "Explicar como funciona o diagnóstico", "Receber o equipamento", "Diagnosticar e passar o orçamento", "Executar se aprovado"],
    questions: ["O que acontece exatamente? Desde quando?", "Caiu, molhou ou teve pico de energia?", "Liga? Aparece alguma mensagem?"],
    info_to_collect: ["Marca e modelo", "Descrição do defeito", "Fotos ou vídeo do problema"],
    message_templates: [
      { title: "Explicar o diagnóstico", text: "Preciso olhar o equipamento para saber a causa. Depois te passo o orçamento certinho e você decide se quer fazer." },
    ],
    objections: [{ objection: "Não dá para falar o preço agora?", answer: "Sem ver eu estaria chutando. O diagnóstico evita trocar peça à toa." }],
    next_steps: ["Agendar a avaliação", "Abrir a O.S. no Gerenciador"],
  },
  {
    name: "Notebook à venda",
    description: "Atender interessado em um notebook revisado da Trust Care.",
    steps: ["Entender o uso", "Indicar o modelo certo", "Mandar fotos e configuração", "Combinar pagamento e entrega"],
    questions: ["Para que você vai usar o notebook?", "Tem um valor em mente?", "Precisa para quando?"],
    info_to_collect: ["Uso principal", "Faixa de preço", "Forma de pagamento", "Bairro para entrega"],
    message_templates: [
      { title: "Apresentar o notebook", text: "Esse está revisado, com limpeza feita e SSD. Te mando fotos e a configuração completa?" },
      { title: "Garantia", text: "Todos os notebooks saem revisados e com garantia. Qualquer problema, é só me chamar." },
    ],
    objections: [{ objection: "Está caro", answer: "Ele já vem revisado, com SSD e garantia. Comparando com um novo de mesma configuração, sai bem mais em conta." }],
    next_steps: ["Combinar retirada ou entrega", "Registrar a venda nas Finanças"],
  },
];
