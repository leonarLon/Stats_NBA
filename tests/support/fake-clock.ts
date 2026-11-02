import type { Clock } from '@/server/lib/rate-limiter';

/** Relógio controlado: sleep avança o tempo na hora, sem esperar de verdade. */
export function createFakeClock(start = 0): Clock & { sleeps: number[] } {
  let now = start;
  const sleeps: number[] = [];
  return {
    sleeps,
    now: () => now,
    sleep: async (ms: number) => {
      sleeps.push(ms);
      now += ms;
    },
  };
}
