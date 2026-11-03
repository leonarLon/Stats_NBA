import type { ReactNode } from 'react';
import { isAuthEnabled } from '@/server/auth/session';

/** Páginas de conta: coluna estreita e centralizada. */
export default function AccountLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto max-w-md space-y-6 px-4 py-10 sm:py-14">
      {!isAuthEnabled() && (
        <p role="note" className="rounded-lg border border-secondary/50 bg-secondary/10 px-4 py-2 text-sm">
          <strong>Modo demonstração:</strong> cadastro e login ficam desligados enquanto o Supabase não estiver configurado.
        </p>
      )}
      {children}
    </div>
  );
}
