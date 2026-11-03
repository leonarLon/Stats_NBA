import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Termos de uso' };

export default function TermsPage() {
  return (
    <>
      <h1 className="font-display text-4xl font-bold tracking-wide">Termos de uso</h1>
      <p className="text-sm text-muted">Versão de 03/11/2026.</p>

      <h2>1. O que é o STATS ALL IN</h2>
      <p>
        Um site de estatísticas da NBA em português, mantido de forma independente e, por enquanto, sem fins comerciais. Não
        temos afiliação com a NBA nem com qualquer equipe.
      </p>

      <h2>2. Conta e acesso</h2>
      <p>
        Para ver as estatísticas é preciso criar uma conta com e-mail e senha. Cada conta pode usar uma única vez o teste
        grátis de 3 dias. Você é responsável por manter sua senha em segredo. Podemos suspender contas usadas para abuso, como
        criação em massa de contas ou coleta automatizada do conteúdo.
      </p>

      <h2>3. Dados esportivos</h2>
      <p>
        Os números vêm de fontes públicas de terceiros (API-NBA e balldontlie) e são processados automaticamente. Podem conter
        atrasos, falhas ou jogos com box score incompleto, que sinalizamos na página. Estatísticas avançadas são estimativas e
        podem diferir dos números oficiais. Não use o conteúdo como base única para decisões financeiras, como apostas.
      </p>

      <h2>4. Uso permitido</h2>
      <p>
        O conteúdo é para uso pessoal. Não é permitido copiar o site em massa, revender os dados ou contornar a exigência de
        login.
      </p>

      <h2>5. Disponibilidade e mudanças</h2>
      <p>
        O serviço é oferecido como está, sem garantia de funcionamento contínuo. Estes termos podem mudar; a data da versão
        aparece no topo. Você pode excluir sua conta a qualquer momento em “Minha conta”.
      </p>
    </>
  );
}
