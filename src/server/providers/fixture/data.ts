import type { ProviderGame, ProviderPlayerLine, ProviderTeam } from '../types';

/**
 * Dados FICTÍCIOS para desenvolvimento e testes automatizados.
 * Times e jogadores são inventados de propósito, para que nenhum número de teste
 * seja confundido com estatística real.
 */

export const FIXTURE_TEAMS: ProviderTeam[] = [
  { externalId: 'fx-t1', abbreviation: 'AUR', city: 'Aurora', nickname: 'Cometas', fullName: 'Aurora Cometas', conference: 'East', division: 'Atlantic' },
  { externalId: 'fx-t2', abbreviation: 'BRV', city: 'Brava', nickname: 'Marés', fullName: 'Brava Marés', conference: 'East', division: 'Atlantic' },
  { externalId: 'fx-t3', abbreviation: 'CDR', city: 'Cedro', nickname: 'Lenhadores', fullName: 'Cedro Lenhadores', conference: 'West', division: 'Pacific' },
];

const NAMES: Record<string, [first: string, last: string, pos: string]> = {
  'fx-p1': ['Ícaro', 'Lima', 'G'],
  'fx-p2': ['Davi', 'Moura', 'G'],
  'fx-p3': ['Caio', 'Prado', 'F'],
  'fx-p4': ['Téo', 'Ramos', 'F'],
  'fx-p5': ['Noah', 'Sales', 'C'],
  'fx-p6': ['Raí', 'Teles', 'G'],
  'fx-p7': ['Enzo', 'Vidal', 'G'],
  'fx-p8': ['Luan', 'Xavier', 'F'],
  'fx-p9': ['Otto', 'Zanin', 'F'],
  'fx-p10': ['Igor', 'Assis', 'C'],
};

export const FIXTURE_GAMES: ProviderGame[] = [
  {
    externalId: 'fx-g1', seasonStartYear: 2026, seasonType: 'regular', gameDate: '2026-10-28',
    startsAt: '2026-10-28T23:30:00Z', status: 'final',
    homeTeamExternalId: 'AUR', awayTeamExternalId: 'BRV', homeScore: 105, awayScore: 94, overtimePeriods: 0,
  },
  {
    externalId: 'fx-g2', seasonStartYear: 2026, seasonType: 'regular', gameDate: '2026-11-03',
    startsAt: '2026-11-04T00:00:00Z', status: 'scheduled',
    homeTeamExternalId: 'BRV', awayTeamExternalId: 'CDR', homeScore: null, awayScore: null, overtimePeriods: 0,
  },
];

type Line = [id: string, team: string, starter: boolean, min: number, fgm: number, fga: number, fg3m: number, fg3a: number, ftm: number, fta: number, oreb: number, dreb: number, ast: number, stl: number, blk: number, tov: number, pf: number, pm: number];

/** Cinco jogadores por time, 48 minutos cada (soma = 240 min, como exige a validação). */
const G1_LINES: Line[] = [
  ['fx-p1', 'AUR', true, 48, 10, 20, 3, 8, 6, 7, 1, 4, 8, 2, 0, 3, 2, 11],
  ['fx-p2', 'AUR', true, 48, 8, 17, 2, 6, 4, 4, 0, 3, 6, 1, 0, 2, 3, 11],
  ['fx-p3', 'AUR', true, 48, 7, 14, 1, 4, 2, 3, 2, 6, 3, 1, 1, 1, 4, 11],
  ['fx-p4', 'AUR', true, 48, 6, 12, 2, 5, 3, 4, 1, 5, 2, 0, 1, 2, 2, 11],
  ['fx-p5', 'AUR', true, 48, 9, 13, 0, 0, 2, 5, 4, 8, 2, 1, 3, 2, 3, 11],
  ['fx-p6', 'BRV', true, 48, 11, 23, 4, 10, 5, 6, 0, 3, 7, 1, 0, 4, 2, -11],
  ['fx-p7', 'BRV', true, 48, 7, 16, 3, 8, 2, 2, 1, 2, 5, 2, 0, 2, 3, -11],
  ['fx-p8', 'BRV', true, 48, 6, 14, 1, 4, 3, 4, 2, 5, 2, 1, 1, 1, 4, -11],
  ['fx-p9', 'BRV', true, 48, 5, 11, 1, 3, 2, 2, 1, 6, 1, 0, 0, 1, 2, -11],
  ['fx-p10', 'BRV', true, 48, 7, 10, 0, 0, 1, 3, 5, 9, 1, 0, 2, 3, 3, -11],
];

const toLine = ([id, team, starter, min, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, ast, stl, blk, tov, pf, pm]: Line): ProviderPlayerLine => ({
  playerExternalId: id,
  teamExternalId: team,
  firstName: NAMES[id][0],
  lastName: NAMES[id][1],
  position: NAMES[id][2],
  isStarter: starter,
  didNotPlay: false,
  secondsPlayed: min * 60,
  pts: 2 * fgm + fg3m + ftm,
  fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb: oreb + dreb, ast, stl, blk, tov, pf,
  plusMinus: pm,
});

export const FIXTURE_BOX_SCORES: Record<string, ProviderPlayerLine[]> = {
  'fx-g1': G1_LINES.map(toLine),
};
