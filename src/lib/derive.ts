import type { Manager, Season, Matchup, DraftValuePick, BenchWasteRow, DraftTendency, SkillPosition } from "../types.ts";

export interface CareerStats {
  userId: string;
  managerName: string;
  years: number[];
  seasonsPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  championships: number;
  runnerUps: number;
  playoffAppearances: number;
  bestFinish: number;
  worstFinish: number;
}

export function computeCareerStats(managers: Manager[], seasons: Season[]): CareerStats[] {
  const statsByUserId = new Map<string, CareerStats>();
  for (const m of managers) {
    statsByUserId.set(m.userId, {
      userId: m.userId,
      managerName: m.managerName,
      years: [],
      seasonsPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      championships: 0,
      runnerUps: 0,
      playoffAppearances: 0,
      bestFinish: Infinity,
      worstFinish: -Infinity,
    });
  }

  for (const season of seasons) {
    for (const row of season.standings) {
      const stats = statsByUserId.get(row.userId);
      if (!stats) continue;
      stats.years.push(season.year);
      stats.seasonsPlayed += 1;
      stats.wins += row.wins;
      stats.losses += row.losses;
      stats.draws += row.draws;
      stats.pointsFor += row.pointsFor;
      stats.pointsAgainst += row.pointsAgainst;
      if (row.rank === 1) stats.championships += 1;
      if (row.rank === 2) stats.runnerUps += 1;
      if (row.madePlayoffs) stats.playoffAppearances += 1;
      stats.bestFinish = Math.min(stats.bestFinish, row.rank);
      stats.worstFinish = Math.max(stats.worstFinish, row.rank);
    }
  }

  return [...statsByUserId.values()]
    .filter((s) => s.seasonsPlayed > 0)
    .sort((a, b) => b.championships - a.championships || b.wins - a.wins);
}

export interface HeadToHeadRecord {
  userIdA: string;
  userIdB: string;
  aWins: number;
  bWins: number;
  ties: number;
  meetings: Matchup[];
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("::");
}

export function computeHeadToHead(matchups: Matchup[]): Map<string, HeadToHeadRecord> {
  const map = new Map<string, HeadToHeadRecord>();

  for (const m of matchups) {
    const a = m.team1.userId;
    const b = m.team2.userId;
    if (!a || !b || a === b) continue;

    const k = pairKey(a, b);
    let rec = map.get(k);
    if (!rec) {
      const [userIdA, userIdB] = [a, b].sort();
      rec = { userIdA, userIdB, aWins: 0, bWins: 0, ties: 0, meetings: [] };
      map.set(k, rec);
    }
    rec.meetings.push(m);
    if (m.winnerUserId === null) rec.ties += 1;
    else if (m.winnerUserId === rec.userIdA) rec.aWins += 1;
    else rec.bWins += 1;
  }

  for (const rec of map.values()) {
    rec.meetings.sort((x, y) => x.year - y.year || x.week - y.week);
  }

  return map;
}

export function getHeadToHead(
  map: Map<string, HeadToHeadRecord>,
  userIdA: string,
  userIdB: string
): HeadToHeadRecord | null {
  return map.get(pairKey(userIdA, userIdB)) ?? null;
}

export function formatRecord(wins: number, losses: number, draws: number): string {
  return draws > 0 ? `${wins}-${losses}-${draws}` : `${wins}-${losses}`;
}

export function managerNameByUserId(managers: Manager[]): Map<string, string> {
  return new Map(managers.map((m) => [m.userId, m.managerName]));
}

export interface RecordHighlight {
  label: string;
  value: string;
  detail: string;
}

// Highest score, biggest blowout, and closest game among regular-season
// matchups. Pass the full matchup list for all-time records, or a
// year-filtered subset for a single season's records.
export function computeMatchupRecords(matchups: Matchup[]): RecordHighlight[] {
  const regularSeason = matchups.filter((m) => !m.isPlayoff);

  let highestScore = { points: -Infinity, m: null as Matchup | null, isTeam1: true };
  let biggestBlowout = { margin: -Infinity, m: null as Matchup | null };
  let closestGame = { margin: Infinity, m: null as Matchup | null };

  for (const m of regularSeason) {
    if (m.team1.points > highestScore.points) highestScore = { points: m.team1.points, m, isTeam1: true };
    if (m.team2.points > highestScore.points) highestScore = { points: m.team2.points, m, isTeam1: false };

    const margin = Math.abs(m.team1.points - m.team2.points);
    if (margin > biggestBlowout.margin) biggestBlowout = { margin, m };
    if (margin > 0 && margin < closestGame.margin) closestGame = { margin, m };
  }

  const records: RecordHighlight[] = [];

  if (highestScore.m) {
    const team = highestScore.isTeam1 ? highestScore.m.team1 : highestScore.m.team2;
    records.push({
      label: "Highest single-week score",
      value: `${highestScore.points.toFixed(2)} pts`,
      detail: `${team.managerName} — ${highestScore.m.year} Week ${highestScore.m.week}`,
    });
  }

  if (biggestBlowout.m) {
    const { team1, team2 } = biggestBlowout.m;
    const winner = team1.points > team2.points ? team1 : team2;
    const loser = team1.points > team2.points ? team2 : team1;
    records.push({
      label: "Biggest blowout",
      value: `${biggestBlowout.margin.toFixed(2)} pt margin`,
      detail: `${winner.managerName} over ${loser.managerName} — ${biggestBlowout.m.year} Week ${biggestBlowout.m.week}`,
    });
  }

  if (closestGame.m) {
    const { team1, team2 } = closestGame.m;
    const winner = team1.points > team2.points ? team1 : team2;
    const loser = team1.points > team2.points ? team2 : team1;
    records.push({
      label: "Closest game",
      value: `${closestGame.margin.toFixed(2)} pt margin`,
      detail: `${winner.managerName} over ${loser.managerName} — ${closestGame.m.year} Week ${closestGame.m.week}`,
    });
  }

  return records;
}

// Plain, factual recap sentences built directly from the data (round counts,
// records, ranks) — not AI-generated commentary, just templated prose so the
// editorial pages read as more than bare stat tables.
export function seasonRecapSentence(season: Season): string {
  const champion = season.standings.find((s) => s.rank === 1);
  const runnerUp = season.standings.find((s) => s.rank === 2);
  if (!champion) return `The ${season.year} season featured ${season.teamCount} teams.`;

  const regularSeasonLine =
    champion.regularSeasonRank === 1
      ? `finished the regular season atop the standings at ${champion.wins}-${champion.losses}`
      : `finished the regular season at ${champion.wins}-${champion.losses} (${ordinal(champion.regularSeasonRank)} place)`;

  const runnerUpLine = runnerUp ? ` over ${runnerUp.managerName}'s ${runnerUp.teamName}` : "";

  return `In a ${season.teamCount}-team league, ${champion.managerName}'s ${champion.teamName} ${regularSeasonLine}, then won the ${season.year} championship${runnerUpLine}.`;
}

export function careerRecapSentence(stats: CareerStats): string {
  const seasonsWord = stats.seasonsPlayed === 1 ? "season" : "seasons";
  const winPct = stats.wins + stats.losses + stats.draws > 0 ? stats.wins / (stats.wins + stats.losses + stats.draws) : 0;

  const titleLine =
    stats.championships > 0
      ? ` ${stats.managerName} has won ${stats.championships} championship${stats.championships === 1 ? "" : "s"}${
          stats.runnerUps > 0 ? ` and finished runner-up ${stats.runnerUps} time${stats.runnerUps === 1 ? "" : "s"}` : ""
        }.`
      : stats.runnerUps > 0
        ? ` ${stats.managerName} has reached the championship game ${stats.runnerUps} time${stats.runnerUps === 1 ? "" : "s"} without winning it.`
        : ` ${stats.managerName} is still chasing a first title.`;

  return `Across ${stats.seasonsPlayed} ${seasonsWord}, ${stats.managerName} has gone ${formatRecord(
    stats.wins,
    stats.losses,
    stats.draws
  )} (${(winPct * 100).toFixed(1)}%), with a best finish of ${ordinal(stats.bestFinish)}.${titleLine}`;
}

// draftValue.json is already sorted by value descending (biggest steals
// first), so these are just clear, named slices of it.
export function topSteals(draftValue: DraftValuePick[], n: number): DraftValuePick[] {
  return draftValue.slice(0, n);
}

export function topBusts(draftValue: DraftValuePick[], n: number): DraftValuePick[] {
  return [...draftValue].sort((a, b) => a.value - b.value).slice(0, n);
}

export function draftValueForManager(draftValue: DraftValuePick[], userId: string): DraftValuePick[] {
  return draftValue.filter((p) => p.userId === userId).sort((a, b) => b.value - a.value);
}

export function topStealsByPosition(draftValue: DraftValuePick[], pos: SkillPosition, n: number): DraftValuePick[] {
  return topSteals(
    draftValue.filter((p) => p.pos === pos),
    n
  );
}

export function topBustsByPosition(draftValue: DraftValuePick[], pos: SkillPosition, n: number): DraftValuePick[] {
  return topBusts(
    draftValue.filter((p) => p.pos === pos),
    n
  );
}

// A manager's single best/worst value pick at each position they've drafted.
export function draftValueForManagerByPosition(
  draftValue: DraftValuePick[],
  userId: string
): Partial<Record<SkillPosition, { best: DraftValuePick; worst: DraftValuePick }>> {
  const mine = draftValueForManager(draftValue, userId);
  const result: Partial<Record<SkillPosition, { best: DraftValuePick; worst: DraftValuePick }>> = {};
  for (const pos of ["QB", "RB", "WR", "TE"] as SkillPosition[]) {
    const picks = mine.filter((p) => p.pos === pos);
    if (picks.length === 0) continue;
    result[pos] = { best: picks[0], worst: picks[picks.length - 1] };
  }
  return result;
}

export interface ManagerBenchWaste {
  userId: string;
  managerName: string;
  seasonsPlayed: number;
  totalWasted: number;
  avgWastedPerSeason: number;
  worstSeason: { year: number; wastedPoints: number } | null;
}

export function benchWasteByManager(benchWaste: BenchWasteRow[]): ManagerBenchWaste[] {
  const byManager = new Map<string, BenchWasteRow[]>();
  for (const row of benchWaste) {
    const list = byManager.get(row.userId) ?? [];
    list.push(row);
    byManager.set(row.userId, list);
  }

  const result: ManagerBenchWaste[] = [];
  for (const [userId, rows] of byManager) {
    const totalWasted = rows.reduce((sum, r) => sum + r.wastedPoints, 0);
    const worst = rows.reduce((a, b) => (b.wastedPoints > a.wastedPoints ? b : a));
    result.push({
      userId,
      managerName: rows[0].managerName,
      seasonsPlayed: rows.length,
      totalWasted,
      avgWastedPerSeason: totalWasted / rows.length,
      worstSeason: { year: worst.year, wastedPoints: worst.wastedPoints },
    });
  }
  return result.sort((a, b) => a.totalWasted - b.totalWasted);
}

const TENDENCY_POSITIONS: SkillPosition[] = ["QB", "RB", "WR", "TE"];

// e.g. "Drafts RB earliest (avg round 3.1); waits longest on QB (avg round 9.3)."
export function draftTendencySummary(tendency: DraftTendency): string | null {
  const entries = TENDENCY_POSITIONS.map((pos) => ({ pos, avgRound: tendency.avgRoundByPos[pos] })).filter(
    (e): e is { pos: SkillPosition; avgRound: number } => e.avgRound !== undefined
  );
  if (entries.length < 2) return null;

  const earliest = entries.reduce((a, b) => (b.avgRound < a.avgRound ? b : a));
  const latest = entries.reduce((a, b) => (b.avgRound > a.avgRound ? b : a));
  if (earliest.pos === latest.pos) return null;

  return `Drafts ${earliest.pos} earliest on average (round ${earliest.avgRound.toFixed(1)}); waits longest on ${latest.pos} (round ${latest.avgRound.toFixed(1)}).`;
}

function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
