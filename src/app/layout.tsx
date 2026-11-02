import type { Metadata } from 'next';
import { Barlow_Condensed, Inter } from 'next/font/google';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import './globals.css';

const inter = Inter({ variable: '--font-inter', subsets: ['latin'] });

const barlow = Barlow_Condensed({
  variable: '--font-barlow',
  subsets: ['latin'],
  weight: ['600', '700'],
});

export const metadata: Metadata = {
  title: {
    default: 'Tabelinha — Estatística de basquete, explicada',
    template: '%s · Tabelinha',
  },
  description:
    'Estatísticas de jogadores, times e partidas da NBA em português, atualizadas automaticamente após cada jogo.',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} ${barlow.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#conteudo"
          className="sr-only rounded-md bg-primary px-4 py-2 font-semibold text-on-primary focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50"
        >
          Pular para o conteúdo
        </a>
        <SiteHeader />
        <main id="conteudo" className="flex-1">
          {children}
        </main>
        <SiteFooter />
      </body>
    </html>
  );
}
