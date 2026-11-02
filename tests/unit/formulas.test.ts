import { describe, expect, it } from 'vitest';
import {
  coefficientOfVariation,
  efgPct,
  fgPct,
  isDoubleDouble,
  isTripleDouble,
  minGamesToQualify,
  minutesPerGame,
  pace,
  perGame,
  possessions,
  rating,
  round,
  stddev,
  tsPct,
} from '@/server/domain/formulas';

describe('percentuais', () => {
  it('usa razão das somas', () => {
    // 1/1 num jogo e 0/9 no outro: média dos percentuais seria 50%, o correto é 10%
    expect(fgPct({ fgm: 1 + 0, fga: 1 + 9 })).toBe(0.1);
  });

  it('retorna null sem tentativas', () => {
    expect(fgPct({ fgm: 0, fga: 0 })).toBeNull();
    expect(tsPct({ pts: 0, fga: 0, fta: 0 })).toBeNull();
  });

  it('eFG% e TS% seguem as fórmulas documentadas', () => {
    expect(round(efgPct({ fgm: 18, fg3m: 4, fga: 36 }), 3)).toBe(0.556);
    // 50 / (2 · (36 + 0,44·12)) = 0,6056
    expect(round(tsPct({ pts: 50, fga: 36, fta: 12 }), 3)).toBe(0.606);
  });
});

describe('médias', () => {
  it('divide pelo número de jogos disputados', () => {
    expect(perGame(50, 2)).toBe(25);
    expect(perGame(10, 0)).toBeNull();
    expect(minutesPerGame({ secondsPlayed: 2 * 36 * 60, gamesPlayed: 2 })).toBe(36);
  });
});

describe('posses, ratings e pace', () => {
  const team = { fga: 88, oreb: 10, tov: 12, fta: 20 };

  it('estima posses e exige rebotes ofensivos', () => {
    expect(possessions(team)).toBeCloseTo(98.8);
    expect(possessions({ ...team, oreb: null })).toBeNull();
  });

  it('calcula rating por 100 posses', () => {
    expect(round(rating(110, 100), 1)).toBe(110);
    expect(rating(110, null)).toBeNull();
  });

  it('calcula pace para 48 minutos', () => {
    expect(pace(100, 98, 240)).toBe(99);
    expect(round(pace(110, 108, 265), 1)).toBe(98.7); // uma prorrogação
  });
});

describe('double-double e triple-double', () => {
  const base = { pts: 0, reb: 0, ast: 0, stl: 0, blk: 0 };
  it('conta categorias com 10 ou mais', () => {
    expect(isDoubleDouble({ ...base, pts: 10, reb: 10 })).toBe(true);
    expect(isDoubleDouble({ ...base, pts: 30, reb: 9 })).toBe(false);
    expect(isTripleDouble({ ...base, pts: 10, reb: 10, ast: 10 })).toBe(true);
    expect(isDoubleDouble({ ...base, pts: 10, reb: 10, ast: 10 })).toBe(true);
  });
});

describe('qualificação e consistência', () => {
  it('exige 70% dos jogos do time, arredondando para cima', () => {
    expect(minGamesToQualify(10)).toBe(7);
    expect(minGamesToQualify(11)).toBe(8);
    expect(minGamesToQualify(0)).toBe(0);
  });

  it('calcula desvio padrão populacional', () => {
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBe(2);
    expect(stddev([])).toBeNull();
  });

  it('coeficiente de variação exige jogos e média mínimos', () => {
    expect(coefficientOfVariation([20, 20, 20])).toBeNull();
    expect(coefficientOfVariation(Array(10).fill(5))).toBeNull();
    expect(coefficientOfVariation(Array(10).fill(20))).toBe(0);
  });
});
