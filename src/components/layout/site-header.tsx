import Link from 'next/link';
import { Logo } from '@/components/brand/logo';

const NAV = [
  { href: '/#recursos', label: 'Recursos' },
  { href: '/#dados', label: 'Como calculamos' },
  { href: '/#planos', label: 'Planos' },
];

export function SiteHeader() {
  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/" aria-label="Tabelinha — página inicial" className="rounded-md">
          <Logo />
        </Link>
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
      </div>
    </header>
  );
}
