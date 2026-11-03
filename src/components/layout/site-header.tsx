import Link from 'next/link';
import { Suspense } from 'react';
import { Logo } from '@/components/brand/logo';
import { buttonClasses } from '@/components/ui/button';
import { getCurrentUser, isAuthEnabled } from '@/server/auth/session';

const NAV = [
  { href: '/jogos', label: 'Jogos' },
  { href: '/classificacao', label: 'Classificação' },
  { href: '/jogadores', label: 'Jogadores' },
  { href: '/times', label: 'Times' },
  { href: '/planos', label: 'Planos' },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" aria-label="STATS ALL IN — página inicial" className="rounded-md">
          <Logo />
        </Link>
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <nav aria-label="Principal">
            <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
              {NAV.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="hover:text-text">
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          {/* Lê a sessão: fica fora da casca estática e chega por streaming */}
          <Suspense fallback={<span className="inline-block h-9 w-20" aria-hidden="true" />}>
            <AccountLink />
          </Suspense>
        </div>
      </div>
    </header>
  );
}

async function AccountLink() {
  if (!isAuthEnabled()) return null;
  const user = await getCurrentUser();
  return user ? (
    <Link href="/conta" className={buttonClasses('secondary', 'md', 'min-h-9')}>
      Minha conta
    </Link>
  ) : (
    <Link href="/entrar" className={buttonClasses('primary', 'md', 'min-h-9')}>
      Entrar
    </Link>
  );
}
