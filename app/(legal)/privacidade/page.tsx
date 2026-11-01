import type { Metadata } from "next";

import { LegalPage } from "../legal-page";

export const metadata: Metadata = { title: "Política de privacidade" };

export default function PrivacyPage() {
  return (
    <LegalPage title="Política de privacidade" updated="1º de novembro de 2026">
      <p>
        O Segundo Cérebro é um sistema de organização de uso exclusivamente pessoal, mantido por Luan Sabino Paixão. Apenas
        o próprio titular tem acesso; não há cadastro aberto ao público.
      </p>
      <h2>Dados tratados</h2>
      <ul>
        <li>E-mail e nome da conta Google, usados só para o login.</li>
        <li>
          Eventos das agendas do Google Agenda que o titular escolhe sincronizar, para exibi-los e editá-los dentro do
          sistema.
        </li>
        <li>Tarefas, notas, ideias e demais conteúdos digitados pelo próprio titular.</li>
      </ul>
      <h2>Como os dados são guardados</h2>
      <p>
        Os dados ficam em banco de dados no Supabase (região São Paulo), com acesso restrito ao titular. Os tokens de acesso
        ao Google são guardados criptografados e nunca são enviados ao navegador.
      </p>
      <h2>Compartilhamento</h2>
      <p>
        Os dados não são vendidos nem compartilhados com terceiros. Os dados obtidos das APIs do Google são usados apenas
        para oferecer as funções de agenda ao próprio titular, de acordo com a Política de Dados do Usuário dos Serviços de
        API do Google, incluindo os requisitos de uso limitado.
      </p>
      <h2>Exclusão</h2>
      <p>
        O acesso ao Google pode ser revogado a qualquer momento em Configurações › Google Agenda › Desconectar, ou em
        myaccount.google.com/permissions. Ao desconectar, os eventos sincronizados são removidos do sistema.
      </p>
      <h2>Contato</h2>
      <p>lsp3037@gmail.com</p>
    </LegalPage>
  );
}
