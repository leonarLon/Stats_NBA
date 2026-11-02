import { describe, expect, it } from 'vitest';
import type { GameScore, PlayerGameLine } from '@/server/domain/types';
import { validateGameBoxScore, validatePlayerLine } from '@/server/domain/validation';
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

describe('validação de jogo', () => {
  it('aceita o jogo de fixture consistente', async () => {
    const { score, lines } = await fixtureGame();
    expect(validateGameBoxScore(score, lines)).toEqual([]);
  });

  it('detecta soma de pontos diferente do placar', async () => {
    const { score, lines } = await fixtureGame();
    expect(rules(validateGameBoxScore({ ...score, homeScore: score.homeScore + 2 }, lines))).toContain('score');
  });

  it('detecta minutos do time incompatíveis', async () => {
    const { score, lines } = await fixtureGame();
    lines[0] = { ...lines[0], secondsPlayed: lines[0].secondsPlayed - 5 * 60 };
    expect(rules(validateGameBoxScore(score, lines))).toContain('team_minutes');
  });

  it('detecta jogador repetido e time ausente', async () => {
    const { score, lines } = await fixtureGame();
    const home = lines.filter((l) => l.teamExternalId === score.homeTeamExternalId);
    expect(rules(validateGameBoxScore(score, [...home, home[0]]))).toEqual(expect.arrayContaining(['duplicate_player', 'team_missing']));
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
