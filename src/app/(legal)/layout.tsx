import type { ReactNode } from 'react';

/** Textos legais: coluna de leitura com títulos e listas estilizados. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl space-y-4 px-4 py-10 leading-relaxed sm:py-14 [&_h2]:pt-4 [&_h2]:font-display [&_h2]:text-2xl [&_h2]:font-semibold [&_h2]:tracking-wide [&_li]:ml-5 [&_li]:list-disc [&_ul]:space-y-1">
      {children}
    </article>
  );
}
