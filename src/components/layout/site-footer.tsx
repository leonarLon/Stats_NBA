import Link from 'next/link';

export function SiteFooter() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto max-w-6xl space-y-2 px-4 py-6 text-sm text-muted">
        <p>
          O STATS ALL IN é um projeto independente, sem afiliação com a NBA ou com qualquer equipe. Dados fornecidos por
          API-NBA (api-sports.io) e balldontlie.
        </p>
        <p>Estatísticas avançadas são estimativas calculadas a partir do box score e podem diferir dos números oficiais.</p>
        <p className="flex gap-4">
          <Link href="/termos" className="underline hover:text-text">
            Termos de uso
          </Link>
          <Link href="/privacidade" className="underline hover:text-text">
            Privacidade
          </Link>
        </p>
      </div>
    </footer>
  );
}
