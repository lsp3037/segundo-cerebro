# Segundo Cérebro - Finanças e Trust Care

Vocabulário e modelo de domínio do módulo financeiro pessoal e da gestão de notebooks de revenda da Trust Care.

## Language

### Notebooks e Estoque

**Notebook de Revenda**:
Ativo de estoque próprio da Trust Care adquirido (usado ou avariado) para reparo, upgrade e comercialização com margem de lucro.
_Avoid_: Notebook de cliente, O.S., Aparelho de terceiros

**Preço Pretendido (`asking_price_cents`)**:
Valor de vitrine ou anúncio planejado para a venda do notebook de revenda, utilizado para projetar o lucro antes do fechamento.
_Avoid_: Valor sugerido, Preço de custo

**Custo de Aquisição**:
Valor pago na compra inicial da carcaça ou do notebook usado antes de qualquer reparo ou melhoria.
_Avoid_: Investimento total, Custo de reparo

**Garantia de Balcão**:
Período assegurado pela Trust Care ao comprador final do notebook de revenda (ex: 90 dias) a partir da data de entrega.
_Avoid_: Garantia de fábrica, Cobertura de serviço

**Custo de Garantia (Pós-Venda)**:
Despesa com reparo, substituição de peça ou insumo incorrida após a venda do notebook durante o período de garantia de balcão, debitada do lucro líquido realizado daquela máquina.
_Avoid_: Custo de aquisição, Devolução, Prejuízo geral

**Tempo em Prateleira (Dias em Estoque)**:
Período corrido entre a data de aquisição do notebook de revenda e a data de sua venda efetiva (ou data atual se ainda em estoque), servindo como indicador de liquidez e alerta de estagnação de capital.
_Avoid_: Prazo de garantia, Tempo de bancada

**Taxa de Intermediação (Maquininha)**:
Custo financeiro cobrado pela credenciadora/adquirente da maquininha de cartão na venda à vista ou parcelada, abatido da receita bruta para apuração do lucro líquido real da máquina.
_Avoid_: Custo de peça, Desconto para cliente

---

### Contabilidade, Extratos e Fluxo de Caixa

**Ledger**:
Livro contábil que segrega a origem e o destino dos recursos entre a pessoa física/familiar (`pessoal`) e a operação da empresa (`trustcare`).
_Avoid_: Conta bancária, Carteira, Saldo

**Regime de Caixa**:
Método de registro financeiro baseado na data exata em que o recurso financeiro entra ou sai da conta.
_Avoid_: Regime de competência, Balanço patrimonial

**Transferência Interna (Pró-labore / Retirada)**:
Movimentação de fundos entre a Trust Care e a conta pessoal do Luan, sem representar nova receita bruta consolidada do ecossistema.
_Avoid_: Faturamento pessoal, Lucro líquido pessoal, Despesa de terceiros

**Extrato OFX**:
Arquivo de intercâmbio financeiro aberto (.ofx / SGML-XML) gerado pelos bancos brasileiros (Nubank, Itaú, Sicredi, Inter, etc.) contendo as movimentações da conta com metadados estruturados.
_Avoid_: Extrato em PDF, Print de tela, Open Finance API

**Identificador de Transação Bancária (`FITID`)**:
Código identificador alfanumérico único emitido pela instituição financeira para cada transação contida no extrato OFX, empregado como chave de idempotência para impedir lançamentos duplicados.
_Avoid_: NSU, Código de barras, Protocolo
