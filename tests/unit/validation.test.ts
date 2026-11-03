import { describe, expect, it } from 'vitest';
import type { GameScore, PlayerGameLine } from '@/server/domain/types';
import { classifyBoxScore, teamMinutesToleranceSeconds, validatePlayerLine } from '@/server/domain/validation';
import { FixtureProvider } from '@/server/providers/fixture/fixture-provider';

const provider = new FixtureProvider();

async function fixtureGame(): Promise<{ score: GameScore; lines: PlayerGameLine[] }> {
  const [game] = await provider.listGames({ from: '2026-10-28', to: '2026-10-28' });
  const lines = await provider.getPlayerGameStats(game.externalId);
  return {
    score: {
      homeTeamExternalId: game.homeTeamExternalId,
      awayTeamExternalId: game.awayTeamExternalId,
      homeScore: game.homeScore!,
      awayScore: game.awayScore!,
      overtimePeriods: game.overtimePeriods,
    },
    lines,
  };
}

const rules = (issues: { rule: string }[]) => issues.map((i) => i.rule);

describe('classificação do box score', () => {
  it('jogo de fixture consistente é completo', async () => {
    const { score, lines } = await fixtureGame();
    expect(classifyBoxScore(score, lines)).toEqual({ status: 'complete', errors: [], gaps: [] });
  });

  it('jogadores faltando na fonte → parcial (caso real LAC @ GSW)', async () => {
    const { score, lines } = await fixtureGame();
    // Remove dois jogadores do time da casa: soma de pontos e minutos fica abaixo do total
    const home = lines.filter((l) => l.teamExternalId === score.homeTeamExternalId);
    const result = classifyBoxScore(score, lines.filter((l) => l !== home[0] && l !== home[1]));
    expect(result.status).toBe('partial');
    expect(rules(result.gaps)).toEqual(expect.arrayContaining(['score', 'team_minutes']));
    expect(result.errors).toEqual([]);
  });

  it('time inteiro sem linhas → parcial', async () => {
    const { score, lines } = await fixtureGame();
    const result = classifyBoxScore(score, lines.filter((l) => l.teamExternalId === score.homeTeamExternalId));
    expect(result.status).toBe('partial');
    expect(rules(result.gaps)).toContain('team_missing');
  });

  it('soma de pontos acima do placar → inválido', async () => {
    const { score, lines } = await fixtureGame();
    const result = classifyBoxScore({ ...score, homeScore: score.homeScore - 2 }, lines);
    expect(result.status).toBe('invalid');
    expect(rules(result.errors)).toContain('score');
  });

  it('minutos acima do possível → inválido', async () => {
    const { score, lines } = await fixtureGame();
    // 5 titulares com 48 min + um reserva com 10 min = 250 min
    const extra = { ...lines[0], playerExternalId: 'fx-extra', secondsPlayed: 10 * 60, pts: 0, fgm: 0, fga: 0, fg3m: 0, fg3a: 0, ftm: 0, fta: 0 };
    const result = classifyBoxScore(score, [...lines, extra]);
    expect(result.status).toBe('invalid');
    expect(rules(result.errors)).toContain('team_minutes');
  });

  it('linha inconsistente ou jogador repetido → inválido, mesmo com lacunas', async () => {
    const { score, lines } = await fixtureGame();
    expect(classifyBoxScore(score, [...lines, lines[0]]).status).toBe('invalid');
    const broken = [{ ...lines[0], pts: lines[0].pts + 1 }, ...lines.slice(1)];
    expect(classifyBoxScore(score, broken).status).toBe('invalid');
  });

  it('tolera arredondamento de minutos inteiros (caso real LAL: 239 de 240 min, 11 jogadores)', async () => {
    const { score, lines } = await fixtureGame();
    const rounded = lines.map((l, i) => (i === 0 ? { ...l, secondsPlayed: l.secondsPlayed - 60 } : l));
    expect(classifyBoxScore(score, rounded).status).toBe('complete');
    expect(teamMinutesToleranceSeconds(11)).toBe(330);
    expect(teamMinutesToleranceSeconds(1)).toBe(60);
  });
});

describe('validação de linha', () => {
  const line: PlayerGameLine = {
    playerExternalId: 'p', teamExternalId: 't', isStarter: true, didNotPlay: false, secondsPlayed: 30 * 60,
    pts: 20, fgm: 8, fga: 15, fg3m: 2, fg3a: 5, ftm: 2, fta: 2, oreb: 1, dreb: 4, reb: 5,
    ast: 3, stl: 1, blk: 0, tov: 2, pf: 3, plusMinus: 4,
  };

  it('aceita linha consistente', () => {
    expect(validatePlayerLine(line, 0)).toEqual([]);
  });

  it.each([
    ['points', { pts: 21 }],
    ['shots', { fgm: 16 }],
    ['shots', { fg3m: 6 }],
    ['rebounds', { reb: 7 }],
    ['minutes', { secondsPlayed: 49 * 60 }],
    ['non_negative', { stl: -1 }],
    ['dnp', { didNotPlay: true }],
  ] as const)('detecta regra %s', (rule, patch) => {
    expect(rules(validatePlayerLine({ ...line, ...patch } as PlayerGameLine, 0))).toContain(rule);
  });

  it('permite minutos extras com prorrogação', () => {
    expect(validatePlayerLine({ ...line, secondsPlayed: 50 * 60 }, 1)).toEqual([]);
  });

  it('aceita rebotes ofensivos/defensivos ausentes', () => {
    expect(validatePlayerLine({ ...line, oreb: null, dreb: null }, 0)).toEqual([]);
  });
});
