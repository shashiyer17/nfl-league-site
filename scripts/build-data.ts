// Reads the raw per-year NFL.com fantasy JSON export and emits normalized,
// cross-year-joinable JSON into src/data/generated/ for the React app to import.
//
// Run with: npx tsx scripts/build-data.ts
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import type {
  Manager,
  ManagerSeason,
  Season,
  SeasonStandingRow,
  PlayoffGame,
  Matchup,
  MatchupTeam,
  DraftPick,
  Trade,
  TradeAsset,
  WeeklyTopPerformer,
  SkillPosition,
  PositionBest,
  DraftValuePick,
  RepeatDraftee,
  BenchWasteRow,
  DraftTendency,
  VolatilityEntry,
} from "../src/types.ts";

const RAW_ROOT = "/Users/shashankiyer/Desktop/go-nfl-fantasy/8595862-tbs-fantasy-2025";
const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];
const OUT_DIR = join(import.meta.dirname, "..", "src", "data", "generated");

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf-8")) as T;
}

function yearFile<T>(year: number, name: string): T {
  return readJson<T>(join(RAW_ROOT, String(year), name));
}

// ---- players.json: global playerId -> playerName lookup ----
interface RawPlayer {
  playerId: string;
  playerName: string;
  pos: string;
}
const players = readJson<RawPlayer[]>(join(RAW_ROOT, "players.json"));
const playerNameById = new Map(players.map((p) => [p.playerId, p.playerName]));
// True position (QB/RB/WR/TE/K/DEF), as opposed to the roster *slot* a player
// occupied in a given week (e.g. "WRRB_FLEX", "BN") which is what the per-week
// and end-roster raw files record under their own "pos" field. Any stat that
// needs to know what a player actually plays must resolve through this map,
// never through a raw file's own "pos".
const playerPosById = new Map(players.map((p) => [p.playerId, p.pos]));
const SKILL_POSITIONS = new Set<SkillPosition>(["QB", "RB", "WR", "TE"]);
function isSkillPosition(pos: string | undefined): pos is SkillPosition {
  return pos !== undefined && SKILL_POSITIONS.has(pos as SkillPosition);
}

// ---- Pass 1: managers-history.json per year -> Manager[] keyed by userId ----
interface RawManager {
  year: number;
  managerName: string;
  userId: string;
  coManagerName: string | null;
  coUserId: string | null;
  teamName: string;
  teamId: string;
  teamImgUrl: string;
}

const managerByUserId = new Map<string, Manager>();
// per-year lookup: teamId -> { userId, managerName, teamName }
const teamInfoByYear = new Map<number, Map<string, { userId: string; managerName: string; teamName: string }>>();

for (const year of YEARS) {
  const raw = yearFile<RawManager[]>(year, "managers-history.json");
  const teamInfo = new Map<string, { userId: string; managerName: string; teamName: string }>();
  teamInfoByYear.set(year, teamInfo);

  for (const m of raw) {
    teamInfo.set(m.teamId, { userId: m.userId, managerName: m.managerName, teamName: m.teamName });

    const season: ManagerSeason = { year, teamId: m.teamId, teamName: m.teamName, managerName: m.managerName };
    const existing = managerByUserId.get(m.userId);
    if (existing) {
      existing.seasons.push(season);
      existing.managerName = m.managerName; // keep most recent display name
    } else {
      managerByUserId.set(m.userId, { userId: m.userId, managerName: m.managerName, seasons: [season] });
    }
  }
}

for (const manager of managerByUserId.values()) {
  manager.seasons.sort((a, b) => a.year - b.year);
}

const managers: Manager[] = [...managerByUserId.values()].sort((a, b) => a.managerName.localeCompare(b.managerName));

function resolveTeam(year: number, teamId: string) {
  const info = teamInfoByYear.get(year)?.get(teamId);
  if (!info) throw new Error(`No manager info for year ${year} teamId ${teamId}`);
  return info;
}

// Trade legs can send a player "to" an empty teamId, meaning it was dropped
// to free agency as part of the transaction rather than given to a manager.
const FREE_AGENCY = { userId: "", managerName: "Free Agency", teamName: "Free Agency" };
function resolveTeamOrFreeAgency(year: number, teamId: string) {
  if (teamId === "") return FREE_AGENCY;
  return resolveTeam(year, teamId);
}

// ---- Pass 2: seasons.json (standings + playoff bracket per year) ----
interface RawRegularStanding {
  year: number;
  teamId: string;
  divisionRank: number;
  overallRank: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
}
interface RawEndStanding {
  year: number;
  rank: number;
  teamId: string;
  teamName: string;
}
interface RawPlayoffGame {
  year: number;
  week: number;
  round: number;
  roundLabel: string;
  bracketType: string;
  team1Id: string;
  team1Seed: number;
  team2Id: string;
  team2Seed: number;
  team1Points: number;
  team2Points: number;
  winner: string;
}

const seasons: Season[] = [];

for (const year of YEARS) {
  const regular = yearFile<RawRegularStanding[]>(year, "regular-season-standings-history.json");
  const endStandings = yearFile<RawEndStanding[]>(year, "end-standings-history.json");
  const playoffsRaw = yearFile<RawPlayoffGame[]>(year, "playoff-history.json");

  const regularByTeamId = new Map(regular.map((r) => [r.teamId, r]));

  const championshipTeamIds = new Set<string>();
  for (const g of playoffsRaw) {
    if (g.bracketType === "Championship") {
      championshipTeamIds.add(g.team1Id);
      championshipTeamIds.add(g.team2Id);
    }
  }

  const standings: SeasonStandingRow[] = endStandings
    .map((es): SeasonStandingRow => {
      const info = resolveTeam(year, es.teamId);
      const reg = regularByTeamId.get(es.teamId);
      if (!reg) throw new Error(`No regular season standing for year ${year} teamId ${es.teamId}`);
      return {
        rank: es.rank,
        teamId: es.teamId,
        userId: info.userId,
        managerName: info.managerName,
        teamName: info.teamName,
        regularSeasonRank: reg.overallRank,
        wins: reg.wins,
        losses: reg.losses,
        draws: reg.draws,
        pointsFor: reg.pointsFor,
        pointsAgainst: reg.pointsAgainst,
        madePlayoffs: championshipTeamIds.has(es.teamId),
      };
    })
    .sort((a, b) => a.rank - b.rank);

  const playoffs: PlayoffGame[] = playoffsRaw.map((g) => {
    const t1 = resolveTeam(year, g.team1Id);
    const t2 = resolveTeam(year, g.team2Id);
    return {
      week: g.week,
      round: g.round,
      roundLabel: g.roundLabel,
      bracketType: g.bracketType,
      team1Id: g.team1Id,
      team1Seed: g.team1Seed,
      team1Points: g.team1Points,
      team1UserId: t1.userId,
      team1ManagerName: t1.managerName,
      team2Id: g.team2Id,
      team2Seed: g.team2Seed,
      team2Points: g.team2Points,
      team2UserId: t2.userId,
      team2ManagerName: t2.managerName,
      winnerUserId: resolveTeam(year, g.winner).userId,
    };
  });

  seasons.push({ year, teamCount: standings.length, standings, playoffs });
}

// ---- Pass 3: matchups.json (regular season + playoff, unified, deduplicated) ----
// matchup-history.json actually repeats the playoff weeks' games (same scores,
// just without bracket labels) instead of listing something distinct. We match
// each playoff-history game to its matchup-history counterpart by (week, team
// pair, order-insensitive) so we keep matchup-history's real matchupId (needed
// to join player-matchup-statistics-history later) while attaching the richer
// bracket metadata, instead of emitting the same game twice.
interface RawMatchup {
  year: number;
  week: number;
  matchupId: string;
  team1Id: string;
  team2Id: string;
  team1Points: number;
  team2Points: number;
}

function toMatchupTeam(year: number, teamId: string, points: number): MatchupTeam {
  const info = resolveTeam(year, teamId);
  return { teamId, userId: info.userId, managerName: info.managerName, teamName: info.teamName, points };
}

function winnerFromPoints(team1: MatchupTeam, team2: MatchupTeam): string | null {
  if (team1.points > team2.points) return team1.userId;
  if (team2.points > team1.points) return team2.userId;
  return null;
}

function weekTeamPairKey(week: number, teamA: string, teamB: string): string {
  return [week, ...[teamA, teamB].sort()].join("::");
}

const matchups: Matchup[] = [];

for (const year of YEARS) {
  const regularRaw = yearFile<RawMatchup[]>(year, "matchup-history.json");
  const playoffsRaw = yearFile<RawPlayoffGame[]>(year, "playoff-history.json");

  const playoffByWeekTeams = new Map<string, RawPlayoffGame>();
  for (const g of playoffsRaw) {
    playoffByWeekTeams.set(weekTeamPairKey(g.week, g.team1Id, g.team2Id), g);
  }
  const consumedPlayoffKeys = new Set<string>();

  for (const m of regularRaw) {
    const key = weekTeamPairKey(m.week, m.team1Id, m.team2Id);
    const playoffGame = playoffByWeekTeams.get(key);
    const team1 = toMatchupTeam(year, m.team1Id, m.team1Points);
    const team2 = toMatchupTeam(year, m.team2Id, m.team2Points);

    if (playoffGame) {
      consumedPlayoffKeys.add(key);
      matchups.push({
        year,
        week: m.week,
        matchupId: m.matchupId,
        isPlayoff: true,
        roundLabel: playoffGame.roundLabel,
        bracketType: playoffGame.bracketType,
        team1,
        team2,
        winnerUserId: resolveTeam(year, playoffGame.winner).userId,
      });
    } else {
      matchups.push({
        year,
        week: m.week,
        matchupId: m.matchupId,
        isPlayoff: false,
        roundLabel: null,
        bracketType: null,
        team1,
        team2,
        winnerUserId: winnerFromPoints(team1, team2),
      });
    }
  }

  // A handful of 2020 championship-round games never appear in matchup-history
  // at all (that season's finals were 2-week aggregate scores recorded under a
  // buggy "week: 0" in the source data). Emit those directly with a synthetic
  // matchupId; there's no per-player stat line to join for them.
  for (const g of playoffsRaw) {
    const key = weekTeamPairKey(g.week, g.team1Id, g.team2Id);
    if (consumedPlayoffKeys.has(key)) continue;
    const team1 = toMatchupTeam(year, g.team1Id, g.team1Points);
    const team2 = toMatchupTeam(year, g.team2Id, g.team2Points);
    matchups.push({
      year,
      week: g.week,
      matchupId: `${year}-playoff-${g.round}-${g.team1Id}-${g.team2Id}`,
      isPlayoff: true,
      roundLabel: g.roundLabel,
      bracketType: g.bracketType,
      team1,
      team2,
      winnerUserId: resolveTeam(year, g.winner).userId,
    });
  }
}

matchups.sort((a, b) => a.year - b.year || a.week - b.week);

// ---- Pass 4: drafts.json ----
interface RawDraftPick {
  year: number;
  round: number;
  pick: number;
  teamId: string;
  teamName: string;
  playerId: string;
  playerName: string;
}

const drafts: DraftPick[] = [];
for (const year of YEARS) {
  const raw = yearFile<RawDraftPick[]>(year, "draft-history.json");
  for (const p of raw) {
    const info = resolveTeam(year, p.teamId);
    drafts.push({
      year,
      round: p.round,
      pick: p.pick,
      teamId: p.teamId,
      userId: info.userId,
      managerName: info.managerName,
      teamName: p.teamName,
      playerId: p.playerId,
      playerName: p.playerName,
    });
  }
}
drafts.sort((a, b) => a.year - b.year || a.round - b.round || a.pick - b.pick);

// ---- Pass 5: trades.json ----
interface RawTradeSend {
  type: string;
  playerId: string;
}
interface RawTradeLeg {
  from: string; // teamId
  to: string; // teamId
  sends: RawTradeSend[];
}
interface RawTrade {
  year: number;
  transactionDate: string;
  transactionWeek: number;
  transactionOwnerUserId: string;
  transaction: RawTradeLeg[];
}

const trades: Trade[] = [];
for (const year of YEARS) {
  const raw = yearFile<RawTrade[]>(year, "trade-history.json");
  for (const t of raw) {
    const assets: TradeAsset[] = [];
    for (const leg of t.transaction) {
      const fromInfo = resolveTeamOrFreeAgency(year, leg.from);
      const toInfo = resolveTeamOrFreeAgency(year, leg.to);
      for (const send of leg.sends) {
        if (send.type !== "player") continue;
        assets.push({
          fromUserId: fromInfo.userId,
          fromManagerName: fromInfo.managerName,
          toUserId: toInfo.userId,
          toManagerName: toInfo.managerName,
          playerId: send.playerId,
          playerName: playerNameById.get(send.playerId) ?? `Unknown player ${send.playerId}`,
        });
      }
    }
    trades.push({
      year,
      transactionDate: t.transactionDate,
      transactionWeek: t.transactionWeek,
      ownerUserId: t.transactionOwnerUserId,
      assets,
    });
  }
}
trades.sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));

// ---- Pass 6: topPerformers.json (highest-scoring started player, per week) ----
// The raw per-player weekly stat lines (player-matchup-statistics-history.json)
// are far too large to ship to the frontend as-is (tens of thousands of rows
// across 6 seasons), so we reduce them here to one summary row per week: the
// single highest-scoring player who was actually in a starting slot (not
// bench/reserve, which don't count toward the team's score).
interface RawPlayerMatchupStat {
  matchupId: string;
  teamId: string;
  playerId: string;
  pos: string;
  nflTeam: string;
  status: string;
  pts: number;
}

const topPerformers: WeeklyTopPerformer[] = [];
for (const year of YEARS) {
  const raw = yearFile<RawPlayerMatchupStat[]>(year, "player-matchup-statistics-history.json");
  const bestByWeek = new Map<number, RawPlayerMatchupStat>();
  for (const entry of raw) {
    if (entry.status === "BN" || entry.status === "RES") continue;
    const week = Number(entry.matchupId.split("-")[1]);
    const existing = bestByWeek.get(week);
    if (!existing || entry.pts > existing.pts) {
      bestByWeek.set(week, entry);
    }
  }
  for (const [week, entry] of bestByWeek) {
    const info = resolveTeam(year, entry.teamId);
    topPerformers.push({
      year,
      week,
      teamId: entry.teamId,
      userId: info.userId,
      managerName: info.managerName,
      playerId: entry.playerId,
      playerName: playerNameById.get(entry.playerId) ?? `Unknown player ${entry.playerId}`,
      pos: entry.pos,
      nflTeam: entry.nflTeam,
      pts: entry.pts,
    });
  }
}
topPerformers.sort((a, b) => a.year - b.year || a.week - b.week);

// ---- Pass 7: one combined sweep of player-matchup-statistics-history for the
// advanced-stats layer. This file is the only source with weekly, per-player
// granularity, so season point totals (for draft value + position legends),
// weekly position bests, and bench-vs-optimal lineup math all come from a
// single pass over it per year rather than re-reading it three times.
//
// "Season points" here mean total fantasy points a player produced while on
// *any* roster in the league that year, across every status (started, bench,
// IR) — this is deliberately different from "points while started" (used by
// bench-waste below) because draft value should reflect what the player
// actually did, not how well their manager used them.
const seasonPointsByYearPlayer = new Map<string, number>(); // `${year}::${playerId}` -> total pts
const primaryTeamByYearPlayer = new Map<string, Map<string, number>>(); // `${year}::${playerId}` -> teamId -> weeks seen

interface PositionBestCandidate {
  year: number;
  week: number;
  teamId: string;
  playerId: string;
  truePos: SkillPosition;
  pts: number;
}
const weekBestCandidates: PositionBestCandidate[] = [];

// Standard starting lineup for every year in this dataset (verified identical
// 2020-2025): 1 QB, 2 RB, 2 WR, 1 TE, 1 FLEX (RB or WR only), 1 K, 1 DEF.
// Hardcoded rather than parsed from settings-history since it never varies.
//
// 2021 is a documented exception: that season's scoring settings (see
// dstSettings/otherSettings in settings-history.json, which include tackles,
// sacks, forced fumbles etc.) show the league ran individual-defensive-player
// scoring for one year, with 3 additional dedicated starting slots (1 DL, 1
// LB, 1 DB) that settings-history's rosterPositions object doesn't list —
// confirmed empirically: 2021's actual roster data has exactly 1 started
// DL/LB/DB per team in ~97% of team-weeks. Without this, "optimal" excludes
// points these players actually scored while started, producing a nonsensical
// negative "wasted" total.
const BASE_STARTER_COUNTS: Record<string, number> = { QB: 1, RB: 2, WR: 2, TE: 1, K: 1, DEF: 1 };
const FLEX_ELIGIBLE: string[] = ["RB", "WR"];
const FLEX_COUNT = 1;

function starterCountsForYear(year: number): Record<string, number> {
  if (year === 2021) return { ...BASE_STARTER_COUNTS, DL: 1, LB: 1, DB: 1 };
  return BASE_STARTER_COUNTS;
}

function computeOptimalLineupPoints(entries: { playerId: string; pts: number }[], starterCounts: Record<string, number>): number {
  const byTruePos = new Map<string, number[]>();
  for (const e of entries) {
    const truePos = playerPosById.get(e.playerId);
    if (!truePos) continue;
    const list = byTruePos.get(truePos) ?? [];
    list.push(e.pts);
    byTruePos.set(truePos, list);
  }
  for (const list of byTruePos.values()) list.sort((a, b) => b - a);

  let optimal = 0;
  const flexPool: number[] = [];
  for (const [pos, count] of Object.entries(starterCounts)) {
    const list = byTruePos.get(pos) ?? [];
    for (let i = 0; i < count; i++) if (list[i] !== undefined) optimal += list[i];
    if (FLEX_ELIGIBLE.includes(pos)) flexPool.push(...list.slice(count));
  }
  flexPool.sort((a, b) => b - a);
  for (let i = 0; i < FLEX_COUNT; i++) if (flexPool[i] !== undefined) optimal += flexPool[i];
  return optimal;
}

// `${year}::${teamId}` -> running season totals
const benchWasteAccum = new Map<string, { actual: number; optimal: number }>();

for (const year of YEARS) {
  const raw = yearFile<RawPlayerMatchupStat[]>(year, "player-matchup-statistics-history.json");

  const byTeamWeek = new Map<string, RawPlayerMatchupStat[]>(); // `${teamId}::${week}`

  for (const s of raw) {
    const week = Number(s.matchupId.split("-")[1]);

    const seasonKey = `${year}::${s.playerId}`;
    seasonPointsByYearPlayer.set(seasonKey, (seasonPointsByYearPlayer.get(seasonKey) ?? 0) + s.pts);
    const teamCounts = primaryTeamByYearPlayer.get(seasonKey) ?? new Map<string, number>();
    teamCounts.set(s.teamId, (teamCounts.get(s.teamId) ?? 0) + 1);
    primaryTeamByYearPlayer.set(seasonKey, teamCounts);

    if (s.status !== "BN" && s.status !== "RES") {
      const truePos = playerPosById.get(s.playerId);
      if (isSkillPosition(truePos)) {
        weekBestCandidates.push({ year, week, teamId: s.teamId, playerId: s.playerId, truePos, pts: s.pts });
      }
    }

    const twKey = `${s.teamId}::${week}`;
    const list = byTeamWeek.get(twKey) ?? [];
    list.push(s);
    byTeamWeek.set(twKey, list);
  }

  const starterCounts = starterCountsForYear(year);
  for (const [twKey, entries] of byTeamWeek) {
    const teamId = twKey.split("::")[0];
    const actual = entries
      .filter((e) => e.status !== "BN" && e.status !== "RES")
      .reduce((sum, e) => sum + e.pts, 0);
    const optimal = computeOptimalLineupPoints(entries.filter((e) => e.status !== "RES"), starterCounts);

    const accKey = `${year}::${teamId}`;
    const acc = benchWasteAccum.get(accKey) ?? { actual: 0, optimal: 0 };
    acc.actual += actual;
    acc.optimal += optimal;
    benchWasteAccum.set(accKey, acc);
  }
}

function primaryTeamId(year: number, playerId: string): string | null {
  const counts = primaryTeamByYearPlayer.get(`${year}::${playerId}`);
  if (!counts || counts.size === 0) return null;
  let bestTeamId: string | null = null;
  let bestCount = -1;
  for (const [teamId, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestTeamId = teamId;
    }
  }
  return bestTeamId;
}

// ---- Pass 8: positionLegends.json (best QB/RB/WR/TE ever, season & week) ----
const positionLegends: PositionBest[] = [];

// Week bests: top 5 single-week performances per position, from the started
// player pool gathered above.
for (const pos of SKILL_POSITIONS) {
  const candidates = weekBestCandidates.filter((c) => c.truePos === pos).sort((a, b) => b.pts - a.pts);
  for (const c of candidates.slice(0, 5)) {
    const info = resolveTeam(c.year, c.teamId);
    positionLegends.push({
      timeframe: "week",
      pos,
      year: c.year,
      week: c.week,
      playerId: c.playerId,
      playerName: playerNameById.get(c.playerId) ?? `Unknown player ${c.playerId}`,
      userId: info.userId,
      managerName: info.managerName,
      points: c.pts,
    });
  }
}

// Season bests: top 5 season point totals per position, across all years.
interface SeasonBestCandidate {
  year: number;
  playerId: string;
  truePos: SkillPosition;
  pts: number;
}
const seasonBestCandidates: SeasonBestCandidate[] = [];
for (const [key, pts] of seasonPointsByYearPlayer) {
  if (pts <= 0) continue;
  const [yearStr, playerId] = key.split("::");
  const truePos = playerPosById.get(playerId);
  if (!isSkillPosition(truePos)) continue;
  seasonBestCandidates.push({ year: Number(yearStr), playerId, truePos, pts });
}
for (const pos of SKILL_POSITIONS) {
  const candidates = seasonBestCandidates.filter((c) => c.truePos === pos).sort((a, b) => b.pts - a.pts);
  for (const c of candidates.slice(0, 5)) {
    const teamId = primaryTeamId(c.year, c.playerId);
    const info = teamId ? resolveTeam(c.year, teamId) : null;
    positionLegends.push({
      timeframe: "season",
      pos,
      year: c.year,
      week: null,
      playerId: c.playerId,
      playerName: playerNameById.get(c.playerId) ?? `Unknown player ${c.playerId}`,
      userId: info?.userId ?? "",
      managerName: info?.managerName ?? "Unknown",
      points: c.pts,
    });
  }
}

// ---- Pass 9: draftValue.json (steals & busts for QB/RB/WR/TE picks) ----
// K/DEF are excluded: they're always drafted in the last couple of rounds
// near-arbitrarily, so "value relative to draft slot" isn't a meaningful
// story for them the way it is for skill positions.
//
// Value is computed entirely *within* a position: both the draft-order rank
// and the season-points finish rank only compare a player to others at the
// same position drafted that same year (e.g. "the 5th QB taken" vs "the 3rd
// best-scoring QB that year"). Ranking across positions would be meaningless
// here — a mediocre QB outscores most TEs in raw points every year, which
// would make QBs dominate any cross-position "value" list for reasons that
// have nothing to do with how well they were actually drafted.
const draftValue: DraftValuePick[] = [];
for (const year of YEARS) {
  const yearPicks = drafts.filter((d) => d.year === year);
  const skillPicks = yearPicks
    .map((d) => ({ pick: d, truePos: playerPosById.get(d.playerId) }))
    .filter((x): x is { pick: DraftPick; truePos: SkillPosition } => isSkillPosition(x.truePos));

  const withPoints = skillPicks.map(({ pick, truePos }) => ({
    pick,
    truePos,
    seasonPoints: seasonPointsByYearPlayer.get(`${year}::${pick.playerId}`) ?? 0,
  }));

  for (const pos of SKILL_POSITIONS) {
    const atPosition = withPoints.filter((x) => x.truePos === pos);

    const byDraftOrder = [...atPosition].sort((a, b) => a.pick.pick - b.pick.pick);
    const positionalPickByPlayerId = new Map<string, number>();
    byDraftOrder.forEach((entry, i) => positionalPickByPlayerId.set(entry.pick.playerId, i + 1));

    const byPoints = [...atPosition].sort((a, b) => b.seasonPoints - a.seasonPoints);
    const positionalFinishByPlayerId = new Map<string, number>();
    byPoints.forEach((entry, i) => positionalFinishByPlayerId.set(entry.pick.playerId, i + 1));

    for (const { pick, seasonPoints } of atPosition) {
      const positionalPick = positionalPickByPlayerId.get(pick.playerId)!;
      const positionalFinish = positionalFinishByPlayerId.get(pick.playerId)!;
      draftValue.push({
        year,
        round: pick.round,
        pick: pick.pick,
        userId: pick.userId,
        managerName: pick.managerName,
        playerId: pick.playerId,
        playerName: pick.playerName,
        pos,
        seasonPoints,
        positionalPick,
        positionalFinish,
        value: positionalPick - positionalFinish,
      });
    }
  }
}
draftValue.sort((a, b) => b.value - a.value);

// ---- Pass 10: repeatDraftees.json ----
const repeatDraftees: RepeatDraftee[] = [];
{
  const byManagerPlayer = new Map<string, { userId: string; managerName: string; playerId: string; playerName: string; years: number[] }>();
  for (const d of drafts) {
    const key = `${d.userId}::${d.playerId}`;
    const existing = byManagerPlayer.get(key);
    if (existing) {
      existing.years.push(d.year);
    } else {
      byManagerPlayer.set(key, {
        userId: d.userId,
        managerName: d.managerName,
        playerId: d.playerId,
        playerName: d.playerName,
        years: [d.year],
      });
    }
  }
  for (const entry of byManagerPlayer.values()) {
    if (entry.years.length > 1) {
      entry.years.sort((a, b) => a - b);
      repeatDraftees.push(entry);
    }
  }
}
repeatDraftees.sort((a, b) => b.years.length - a.years.length || a.managerName.localeCompare(b.managerName));

// ---- Pass 11: benchWaste.json (season totals, from the accumulator above) ----
const benchWaste: BenchWasteRow[] = [];
for (const [key, acc] of benchWasteAccum) {
  const [yearStr, teamId] = key.split("::");
  const year = Number(yearStr);
  const info = resolveTeam(year, teamId);
  benchWaste.push({
    year,
    teamId,
    userId: info.userId,
    managerName: info.managerName,
    actualPoints: acc.actual,
    optimalPoints: acc.optimal,
    wastedPoints: acc.optimal - acc.actual,
  });
}
benchWaste.sort((a, b) => b.wastedPoints - a.wastedPoints);

// ---- Pass 12: draftTendencies.json (positional breakdown by round, per manager) ----
const draftTendencies: DraftTendency[] = [];
{
  const byManager = new Map<string, DraftPick[]>();
  for (const d of drafts) {
    const list = byManager.get(d.userId) ?? [];
    list.push(d);
    byManager.set(d.userId, list);
  }
  for (const manager of managers) {
    const picks = byManager.get(manager.userId) ?? [];
    if (picks.length === 0) continue;

    const byRound: Record<string, Record<string, number>> = {};
    const roundsByPos = new Map<string, number[]>();
    for (const pick of picks) {
      const truePos = playerPosById.get(pick.playerId) ?? "UNKNOWN";
      const roundKey = String(pick.round);
      byRound[roundKey] ??= {};
      byRound[roundKey][truePos] = (byRound[roundKey][truePos] ?? 0) + 1;

      const list = roundsByPos.get(truePos) ?? [];
      list.push(pick.round);
      roundsByPos.set(truePos, list);
    }

    const avgRoundByPos: Record<string, number> = {};
    for (const [pos, rounds] of roundsByPos) {
      avgRoundByPos[pos] = rounds.reduce((a, b) => a + b, 0) / rounds.length;
    }

    draftTendencies.push({
      userId: manager.userId,
      managerName: manager.managerName,
      totalPicks: picks.length,
      avgRoundByPos,
      byRound,
    });
  }
}

// ---- Pass 13: volatility.json (regular-season week-to-week scoring stdDev) ----
const volatility: VolatilityEntry[] = [];
{
  const scoresByManager = new Map<string, number[]>();
  for (const m of matchups) {
    if (m.isPlayoff) continue;
    for (const team of [m.team1, m.team2]) {
      const list = scoresByManager.get(team.userId) ?? [];
      list.push(team.points);
      scoresByManager.set(team.userId, list);
    }
  }
  for (const manager of managers) {
    const scores = scoresByManager.get(manager.userId);
    if (!scores || scores.length === 0) continue;
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance =
      scores.length > 1
        ? scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / (scores.length - 1)
        : 0;
    volatility.push({
      userId: manager.userId,
      managerName: manager.managerName,
      gamesPlayed: scores.length,
      mean,
      stdDev: Math.sqrt(variance),
    });
  }
}
volatility.sort((a, b) => a.stdDev - b.stdDev);

// ---- Write output ----
mkdirSync(OUT_DIR, { recursive: true });
function write(name: string, data: unknown) {
  writeFileSync(join(OUT_DIR, name), JSON.stringify(data, null, 2));
  console.log(`wrote ${name}`);
}

write("managers.json", managers);
write("seasons.json", seasons);
write("matchups.json", matchups);
write("drafts.json", drafts);
write("trades.json", trades);
write("topPerformers.json", topPerformers);
write("positionLegends.json", positionLegends);
write("draftValue.json", draftValue);
write("repeatDraftees.json", repeatDraftees);
write("benchWaste.json", benchWaste);
write("draftTendencies.json", draftTendencies);
write("volatility.json", volatility);

console.log(
  `Done. ${managers.length} managers, ${seasons.length} seasons, ${matchups.length} matchups, ${drafts.length} draft picks, ${trades.length} trades, ${topPerformers.length} weekly top performers, ${positionLegends.length} position legends, ${draftValue.length} draft-value picks, ${repeatDraftees.length} repeat draftees, ${benchWaste.length} bench-waste rows, ${draftTendencies.length} draft-tendency profiles, ${volatility.length} volatility entries.`
);
