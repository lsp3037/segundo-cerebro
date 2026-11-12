// Modelo das contas fixas da casa, tirado da planilha que o Luan usa hoje.
// Só nomes, dias e pessoas: os valores são digitados por ele na tela (não ficam no código).

export type HouseholdTemplateRow = {
  kind: "income" | "expense";
  description: string;
  dueDay: number | null;
  member: string | null;
  categoryName: string;
  percentBp?: number; // Dízimo: 1000 = 10% das entradas do mês
  isCard?: boolean; // cria o cartão em "Contas & Cartões"
};

export const HOUSEHOLD_TEMPLATE: HouseholdTemplateRow[] = [
  { kind: "income", description: "Salário Luan", dueDay: null, member: "Luan", categoryName: "Salário" },
  { kind: "income", description: "Bolsa Residência", dueDay: null, member: null, categoryName: "Benefícios & Bonificações" },
  { kind: "income", description: "Trust Care", dueDay: null, member: "Luan", categoryName: "Pró-labore & Serviços" },
  { kind: "income", description: "HSH", dueDay: null, member: null, categoryName: "Pró-labore & Serviços" },

  { kind: "expense", description: "Dízimo", dueDay: null, member: "Casa", categoryName: "Dízimo & Ofertas", percentBp: 1000 },
  { kind: "expense", description: "Aluguel Solar das Flores", dueDay: 1, member: "Casa", categoryName: "Moradia (Aluguel/Condomínio)" },
  { kind: "expense", description: "Cartão de Crédito Rayzza", dueDay: 16, member: "Rayzza", categoryName: "Cartões de Crédito", isCard: true },
  { kind: "expense", description: "Cartão de Crédito Luan (Nubank)", dueDay: 17, member: "Luan", categoryName: "Cartões de Crédito", isCard: true },
  { kind: "expense", description: "Cartão de Crédito Luan (Bradesco)", dueDay: 1, member: "Luan", categoryName: "Cartões de Crédito", isCard: true },
  { kind: "expense", description: "Cartão de Crédito Luan (Santander)", dueDay: 5, member: "Luan", categoryName: "Cartões de Crédito", isCard: true },
  { kind: "expense", description: "Energia Solar das Flores", dueDay: 16, member: "Casa", categoryName: "Contas de Consumo (Luz/Água/Net)" },
  { kind: "expense", description: "Internet", dueDay: 10, member: "Casa", categoryName: "Contas de Consumo (Luz/Água/Net)" },
  { kind: "expense", description: "Celular Rayzza", dueDay: 16, member: "Rayzza", categoryName: "Contas de Consumo (Luz/Água/Net)" },
  { kind: "expense", description: "Celular Luan", dueDay: 22, member: "Luan", categoryName: "Contas de Consumo (Luz/Água/Net)" },
  { kind: "expense", description: "UNIMED", dueDay: 25, member: "Casa", categoryName: "Saúde & Farmácia" },
  { kind: "expense", description: "Supermercado", dueDay: null, member: "Casa", categoryName: "Alimentação & Mercado" },
  { kind: "expense", description: "Combustível Rayzza", dueDay: null, member: "Rayzza", categoryName: "Transporte & Veículo" },
  { kind: "expense", description: "Combustível Luan", dueDay: null, member: "Luan", categoryName: "Transporte & Veículo" },
  { kind: "expense", description: "Almoço Luan", dueDay: null, member: "Luan", categoryName: "Alimentação & Mercado" },
];
