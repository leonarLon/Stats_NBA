import type { GameScore, PlayerGameLine } from './types';

export interface ValidationIssue {
  rule: string;
  message: string;
  playerExternalId?: string;
  teamExternalId?: string;
}

const REGULATION_SECONDS = 48 * 60;
const OVERTIME_SECONDS = 5 * 60;

/** Regras por linha de jogador (docs/STATS_FORMULAS.md, seção 2). */
export function validatePlayerLine(line: PlayerGameLine, overtimePeriods: number): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const add = (rule: string, message: string) =>
    issues.push({ rule, message, playerExternalId: line.playerExternalId, teamExternalId: line.teamExternalId });

  const counters = ['pts', 'fgm', 'fga', 'fg3m', 'fg3a', 'ftm', 'fta', 'reb', 'ast', 'stl', 'blk', 'tov', 'pf'] as const;
  for (const key of counters) {
    if (!Number.isInteger(line[key]) || line[key] < 0) add('non_negative', `${key} deve ser inteiro ≥ 0 (recebido ${line[key]})`);
  }
  for (const key of ['oreb', 'dreb'] as const) {
    const v = line[key];
    if (v !== null && (!Number.isInteger(v) || v < 0)) add('non_negative', `${key} deve ser inteiro ≥ 0 (recebido ${v})`);
  }

  if (line.fgm > line.fga) add('shots', 'FGM maior que FGA');
  if (line.fg3m > line.fg3a) add('shots', '3PM maior que 3PA');
  if (line.ftm > line.fta) add('shots', 'FTM maior que FTA');
  if (line.fg3m > line.fgm) add('shots', '3PM maior que FGM');
  if (line.fg3a > line.fga) add('shots', '3PA maior que FGA');

  const expectedPts = 2 * line.fgm + line.fg3m + line.ftm;
  if (line.pts !== expectedPts) add('points', `PTS = ${line.pts}, esperado 2·FGM + 3PM + FTM = ${expectedPts}`);

  if (line.oreb !== null && line.dreb !== null && line.reb !== line.oreb + line.dreb) {
    add('rebounds', `REB = ${line.reb}, esperado OREB + DREB = ${line.oreb + line.dreb}`);
  }

  const maxSeconds = REGULATION_SECONDS + OVERTIME_SECONDS * overtimePeriods;
  if (line.secondsPlayed < 0 || line.secondsPlayed > maxSeconds) {
    add('minutes', `segundos jogados (${line.secondsPlayed}) fora de 0..${maxSeconds}`);
  }

  if (line.didNotPlay && (line.secondsPlayed > 0 || line.pts > 0)) {
    add('dnp', 'jogador marcado como DNP tem minutos ou pontos');
  }

  return issues;
}

/** Tolerância na soma dos minutos do time (arredondamento das fontes). */
const TEAM_MINUTES_TOLERANCE_SECONDS = 60;

/** Regras por jogo (docs/STATS_FORMULAS.md, seção 2). */
export function validateGameBoxScore(score: GameScore, lines: PlayerGameLine[]): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  for (const line of lines) issues.push(...validatePlayerLine(line, score.overtimePeriods));

  const teams = [
    { id: score.homeTeamExternalId, score: score.homeScore },
    { id: score.awayTeamExternalId, score: score.awayScore },
  ];

  for (const team of teams) {
    const teamLines = lines.filter((l) => l.teamExternalId === team.id);
    if (teamLines.length === 0) {
      issues.push({ rule: 'team_missing', message: 'time sem linhas de jogadores', teamExternalId: team.id });
      continue;
    }

    const pts = teamLines.reduce((acc, l) => acc + l.pts, 0);
    if (pts !== team.score) {
      issues.push({
        rule: 'score',
        message: `soma dos pontos dos jogadores (${pts}) difere do placar (${team.score})`,
        teamExternalId: team.id,
      });
    }

    const seconds = teamLines.reduce((acc, l) => acc + l.secondsPlayed, 0);
    const expected = 5 * (REGULATION_SECONDS + OVERTIME_SECONDS * score.overtimePeriods);
    if (Math.abs(seconds - expected) > TEAM_MINUTES_TOLERANCE_SECONDS) {
      issues.push({
        rule: 'team_minutes',
        message: `soma dos minutos (${(seconds / 60).toFixed(1)}) difere do esperado (${expected / 60})`,
        teamExternalId: team.id,
      });
    }
  }

  const unknownTeam = lines.find((l) => l.teamExternalId !== score.homeTeamExternalId && l.teamExternalId !== score.awayTeamExternalId);
  if (unknownTeam) {
    issues.push({ rule: 'team_unknown', message: 'linha de jogador com time que não está no jogo', playerExternalId: unknownTeam.playerExternalId });
  }

  const seen = new Set<string>();
  for (const line of lines) {
    if (seen.has(line.playerExternalId)) {
      issues.push({ rule: 'duplicate_player', message: 'jogador repetido no box score', playerExternalId: line.playerExternalId });
    }
    seen.add(line.playerExternalId);
  }

  return issues;
}
