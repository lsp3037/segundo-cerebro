import type { Metadata } from "next";

import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Termos de uso" };

export default function TermsPage() {
  return (
    <LegalPage title="Termos de uso" updated="1º de novembro de 2026">
      <p>
        O Segundo Cérebro é uma ferramenta pessoal de organização, de uso exclusivo de seu titular, Luan Sabino Paixão. Não
        é oferecida ao público e não aceita novos cadastros.
      </p>
      <p>
        O titular é responsável pelo conteúdo que registra no sistema. Na área Profissional, não devem ser registrados
        dados de pacientes, em respeito à LGPD.
      </p>
      <p>
        A integração com o Google Agenda acessa apenas as agendas escolhidas pelo titular e pode ser desligada a qualquer
        momento. O sistema é fornecido como está, sem garantias de disponibilidade.
      </p>
      <p>Contato: lsp3037@gmail.com</p>
    </LegalPage>
  );
}
