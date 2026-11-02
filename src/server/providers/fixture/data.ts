import type { PlayerGameLine } from '../../domain/types';
import type { ProviderGame, ProviderPlayer, ProviderTeam } from '../types';

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

const player = (externalId: string, firstName: string, lastName: string, teamExternalId: string, position: string): ProviderPlayer => ({
  externalId, firstName, lastName, position, teamExternalId,
  jerseyNumber: null, heightCm: null, weightKg: null, birthDate: null, country: null,
});

export const FIXTURE_PLAYERS: ProviderPlayer[] = [
  player('fx-p1', 'Ícaro', 'Lima', 'fx-t1', 'G'),
  player('fx-p2', 'Davi', 'Moura', 'fx-t1', 'G'),
  player('fx-p3', 'Caio', 'Prado', 'fx-t1', 'F'),
  player('fx-p4', 'Téo', 'Ramos', 'fx-t1', 'F'),
  player('fx-p5', 'Noah', 'Sales', 'fx-t1', 'C'),
  player('fx-p6', 'Raí', 'Teles', 'fx-t2', 'G'),
  player('fx-p7', 'Enzo', 'Vidal', 'fx-t2', 'G'),
  player('fx-p8', 'Luan', 'Xavier', 'fx-t2', 'F'),
  player('fx-p9', 'Otto', 'Zanin', 'fx-t2', 'F'),
  player('fx-p10', 'Igor', 'Assis', 'fx-t2', 'C'),
];

export const FIXTURE_GAMES: ProviderGame[] = [
  {
    externalId: 'fx-g1', seasonStartYear: 2026, seasonType: 'regular', gameDate: '2026-10-28',
    startsAt: '2026-10-28T23:30:00Z', status: 'final',
    homeTeamExternalId: 'fx-t1', awayTeamExternalId: 'fx-t2', homeScore: 105, awayScore: 94, overtimePeriods: 0,
  },
  {
    externalId: 'fx-g2', seasonStartYear: 2026, seasonType: 'regular', gameDate: '2026-11-03',
    startsAt: '2026-11-04T00:00:00Z', status: 'scheduled',
    homeTeamExternalId: 'fx-t2', awayTeamExternalId: 'fx-t3', homeScore: null, awayScore: null, overtimePeriods: 0,
  },
];

type Line = [id: string, team: string, starter: boolean, min: number, fgm: number, fga: number, fg3m: number, fg3a: number, ftm: number, fta: number, oreb: number, dreb: number, ast: number, stl: number, blk: number, tov: number, pf: number, pm: number];

/** Cinco jogadores por time, 48 minutos cada (soma = 240 min, como exige a validação). */
const G1_LINES: Line[] = [
  ['fx-p1', 'fx-t1', true, 48, 10, 20, 3, 8, 6, 7, 1, 4, 8, 2, 0, 3, 2, 11],
  ['fx-p2', 'fx-t1', true, 48, 8, 17, 2, 6, 4, 4, 0, 3, 6, 1, 0, 2, 3, 11],
  ['fx-p3', 'fx-t1', true, 48, 7, 14, 1, 4, 2, 3, 2, 6, 3, 1, 1, 1, 4, 11],
  ['fx-p4', 'fx-t1', true, 48, 6, 12, 2, 5, 3, 4, 1, 5, 2, 0, 1, 2, 2, 11],
  ['fx-p5', 'fx-t1', true, 48, 9, 13, 0, 0, 2, 5, 4, 8, 2, 1, 3, 2, 3, 11],
  ['fx-p6', 'fx-t2', true, 48, 11, 23, 4, 10, 5, 6, 0, 3, 7, 1, 0, 4, 2, -11],
  ['fx-p7', 'fx-t2', true, 48, 7, 16, 3, 8, 2, 2, 1, 2, 5, 2, 0, 2, 3, -11],
  ['fx-p8', 'fx-t2', true, 48, 6, 14, 1, 4, 3, 4, 2, 5, 2, 1, 1, 1, 4, -11],
  ['fx-p9', 'fx-t2', true, 48, 5, 11, 1, 3, 2, 2, 1, 6, 1, 0, 0, 1, 2, -11],
  ['fx-p10', 'fx-t2', true, 48, 7, 10, 0, 0, 1, 3, 5, 9, 1, 0, 2, 3, 3, -11],
];

const toLine = ([id, team, starter, min, fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, ast, stl, blk, tov, pf, pm]: Line): PlayerGameLine => ({
  playerExternalId: id,
  teamExternalId: team,
  isStarter: starter,
  didNotPlay: false,
  secondsPlayed: min * 60,
  pts: 2 * fgm + fg3m + ftm,
  fgm, fga, fg3m, fg3a, ftm, fta, oreb, dreb, reb: oreb + dreb, ast, stl, blk, tov, pf,
  plusMinus: pm,
});

export const FIXTURE_BOX_SCORES: Record<string, PlayerGameLine[]> = {
  'fx-g1': G1_LINES.map(toLine),
};
