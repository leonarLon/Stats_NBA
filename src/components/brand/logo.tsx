import { cn } from '@/lib/cn';

/** Marca: duas setas curvas (passe e devolução) formando o contorno de uma bola. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('h-8 w-8', className)}>
      <path d="M7 13 A9.5 9.5 0 0 1 25 13" fill="none" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
      <polygon points="22.2,12 27.8,12 25,16.5" fill="var(--primary)" />
      <path d="M25 19 A9.5 9.5 0 0 1 7 19" fill="none" stroke="var(--secondary)" strokeWidth="3" strokeLinecap="round" />
      <polygon points="4.2,20 9.8,20 7,15.5" fill="var(--secondary)" />
    </svg>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark />
      <span className="font-display text-2xl font-bold uppercase tracking-wide">
        Stats <span className="text-primary">All In</span>
      </span>
    </span>
  );
}
