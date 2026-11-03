import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Política de privacidade' };

export default function PrivacyPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-wide">Política de privacidade</h1>
      <p className="text-sm text-muted">Versão de 03/11/2026. Elaborada com base na Lei Geral de Proteção de Dados (Lei 13.709/2018).</p>

      <h2>1. Dados que coletamos</h2>
      <ul>
        <li>E-mail e senha da conta. A senha é guardada pelo serviço de autenticação apenas em formato criptografado (hash).</li>
        <li>Datas de cadastro, de aceite destes termos e do teste grátis, e a situação do seu acesso.</li>
        <li>Registros técnicos de acesso (como endereço IP e navegador), mantidos pelos provedores de hospedagem por segurança.</li>
      </ul>
      <p>Não coletamos documentos, endereço ou dados de cartão. Não usamos cookies de publicidade nem de rastreamento.</p>

      <h2>2. Para que usamos</h2>
      <p>
        Para criar e proteger sua conta, liberar o acesso às estatísticas, enviar e-mails de confirmação e de troca de senha e
        prevenir abuso. A base legal é a execução do serviço que você solicitou.
      </p>

      <h2>3. Com quem compartilhamos</h2>
      <p>
        Apenas com os provedores que fazem o site funcionar: Supabase (banco de dados e autenticação) e Vercel (hospedagem),
        que podem processar dados fora do Brasil. Não vendemos nem cedemos seus dados a terceiros.
      </p>

      <h2>4. Cookies</h2>
      <p>Usamos somente os cookies necessários para manter você conectado.</p>

      <h2>5. Seus direitos</h2>
      <p>
        Você pode consultar, corrigir e excluir seus dados. A exclusão é imediata em “Minha conta” → “Excluir conta” e apaga
        cadastro, histórico de acesso e teste grátis.
      </p>

      <h2>6. Por quanto tempo guardamos</h2>
      <p>Enquanto a conta existir. Ao excluí-la, os dados são apagados; cópias de segurança dos provedores expiram sozinhas.</p>
    </>
  );
}
