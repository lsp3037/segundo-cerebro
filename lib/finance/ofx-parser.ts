// Parser de extratos bancários no formato OFX (Open Financial Exchange 1.x e 2.x)
// Suporta a variante SGML tradicional de bancos brasileiros (sem tags de fechamento)
// e a variante XML pura, processando 100% no servidor local sem dependências externas.

export interface OfxTransaction {
  fitid: string;
  date: string; // ISO YYYY-MM-DD (fuso Cuiabá/Brasil)
  amount_cents: number;
  kind: "income" | "expense";
  raw_description: string;
  clean_description: string;
  type: string; // DEBIT | CREDIT | OTHER
}

export interface OfxParseResult {
  success: boolean;
  error?: string;
  bankId?: string;
  accountId?: string;
  startDate?: string;
  endDate?: string;
  transactions: OfxTransaction[];
}

/**
 * Converte data OFX (ex: "20261104120000[-03:BRT]" ou "20261104") em YYYY-MM-DD
 */
export function parseOfxDate(rawDate?: string | null): string {
  if (!rawDate) return new Date().toISOString().slice(0, 10);
  const clean = rawDate.trim();
  if (clean.length < 8) return new Date().toISOString().slice(0, 10);

  const year = clean.slice(0, 4);
  const month = clean.slice(4, 6);
  const day = clean.slice(6, 8);
  return `${year}-${month}-${day}`;
}

/**
 * Higieniza o texto do banco removendo prefixos redundantes de operadoras
 */
export function sanitizeBankDescription(memo: string, name?: string): string {
  let text = (memo || name || "").trim();

  // Decodifica entidades HTML básicas comuns em OFX
  text = text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // Remove ruídos e prefixos operacionais comuns de extratos bancários brasileiros
  const cleaned = text
    .replace(/^(compra\s+a\s+debito|compra\s+a\s+credito|compra\s+com\s+cartao|compra\s+cartao|compra\s+elo|compra\s+mastercard|compra\s+visa)\s*[-:]?\s*/i, "")
    .replace(/^(pagamento\s+de\s+boleto|pagto\s+boleto|pagamento|pagto|pgto)\s*[-:]?\s*/i, "")
    .replace(/^(pix\s+recebido|pix\s+enviado|transf\s+pix|transferencia\s+pix|pix)\s*[-:]?\s*/i, "")
    .replace(/^(ted\s+recebida|ted\s+enviada|doc\s+recebido|doc\s+enviado|ted|doc)\s*[-:]?\s*/i, "")
    .replace(/^(tarifa\s+bancaria|tar\s+banc|tarifa)\s*[-:]?\s*/i, "Tarifa: ")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || text || "Transação Bancária";
}

/**
 * Extrai valor entre tags em formato SGML (sem fechamento) ou XML
 */
function extractTagValue(block: string, tagName: string): string | null {
  // Tenta formato XML: <TAG>valor</TAG>
  const xmlRegex = new RegExp(`<${tagName}>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const xmlMatch = block.match(xmlRegex);
  if (xmlMatch && xmlMatch[1] !== undefined) {
    return xmlMatch[1].trim();
  }

  // Tenta formato SGML clássico: <TAG>valor (até o próximo < ou quebra de linha)
  const sgmlRegex = new RegExp(`<${tagName}>([^<\r\n]+)`, "i");
  const sgmlMatch = block.match(sgmlRegex);
  if (sgmlMatch && sgmlMatch[1] !== undefined) {
    return sgmlMatch[1].trim();
  }

  return null;
}

/**
 * Lê e analisa o conteúdo textual de um arquivo .ofx
 */
export function parseOfx(rawContent: string): OfxParseResult {
  if (!rawContent || typeof rawContent !== "string") {
    return { success: false, error: "Arquivo vazio ou inválido.", transactions: [] };
  }

  try {
    // Normaliza quebras de linha
    const content = rawContent.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

    // Verifica se possui a tag raiz OFX
    if (!content.includes("<OFX>") && !content.includes("<ofx>")) {
      return { success: false, error: "O arquivo selecionado não possui a estrutura padrão OFX bancária.", transactions: [] };
    }

    // Metadados da Conta
    const bankId = extractTagValue(content, "BANKID") ?? extractTagValue(content, "FID") ?? undefined;
    const accountId = extractTagValue(content, "ACCTID") ?? undefined;
    const startDateRaw = extractTagValue(content, "DTSTART");
    const endDateRaw = extractTagValue(content, "DTEND");

    const startDate = startDateRaw ? parseOfxDate(startDateRaw) : undefined;
    const endDate = endDateRaw ? parseOfxDate(endDateRaw) : undefined;

    // Isola todos os blocos de transação <STMTTRN>
    const transactions: OfxTransaction[] = [];
    const stmtSplit = content.split(/<STMTTRN>/i);

    // O primeiro pedaço antes do primeiro <STMTTRN> é cabeçalho
    for (let i = 1; i < stmtSplit.length; i++) {
      const block = stmtSplit[i];

      // Pega até a tag de fechamento ou próximo bloco relevante
      const endIdx = block.search(/<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>/i);
      const trnContent = endIdx !== -1 ? block.slice(0, endIdx) : block;

      const trnType = (extractTagValue(trnContent, "TRNTYPE") ?? "OTHER").toUpperCase();
      const dtPostedRaw = extractTagValue(trnContent, "DTPOSTED");
      const trnAmtRaw = extractTagValue(trnContent, "TRNAMT");
      const fitIdRaw = extractTagValue(trnContent, "FITID");
      const memoRaw = extractTagValue(trnContent, "MEMO");
      const nameRaw = extractTagValue(trnContent, "NAME");

      if (!trnAmtRaw || !dtPostedRaw) continue;

      const numVal = parseFloat(trnAmtRaw.replace(",", ".").trim());
      if (isNaN(numVal)) continue;

      const cents = Math.round(Math.abs(numVal) * 100);
      const isNegative = numVal < 0;
      const isDebitType = trnType === "DEBIT" || trnType === "PAYMENT" || trnType === "FEE";

      const kind: "income" | "expense" = isNegative || (isDebitType && numVal <= 0) ? "expense" : "income";
      const date = parseOfxDate(dtPostedRaw);
      const rawDesc = (memoRaw || nameRaw || "Sem descrição").trim();
      const cleanDesc = sanitizeBankDescription(memoRaw ?? "", nameRaw ?? "");

      // FITID consistente (se o banco não enviou, gera fallback estável com hash de dados)
      const fitid = fitIdRaw ? fitIdRaw.trim() : `gen_${date}_${cents}_${encodeURIComponent(rawDesc.slice(0, 20))}`;

      transactions.push({
        fitid,
        date,
        amount_cents: cents,
        kind,
        raw_description: rawDesc,
        clean_description: cleanDesc,
        type: trnType,
      });
    }

    return {
      success: true,
      bankId,
      accountId,
      startDate,
      endDate,
      transactions,
    };
  } catch (err) {
    console.error("parseOfx error:", err);
    return {
      success: false,
      error: "Ocorreu um erro ao processar as tags do arquivo OFX.",
      transactions: [],
    };
  }
}
