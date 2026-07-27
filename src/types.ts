export interface ManagerSeason {
  year: number;
  teamId: string;
  teamName: string;
  managerName: string;
}

export interface Manager {
  userId: string;
  managerName: string;
  seasons: ManagerSeason[];
}

export interface SeasonStandingRow {
  rank: number;
  teamId: string;
  userId: string;
  managerName: string;
  teamName: string;
  regularSeasonRank: number;
  wins: number;
  losses: number;
  draws: number;
  pointsFor: number;
  pointsAgainst: number;
  madePlayoffs: boolean;
}

export interface PlayoffGame {
  week: number;
  round: number;
  roundLabel: string;
  bracketType: string;
  team1Id: string;
  team1Seed: number;
  team1Points: number;
  team1UserId: string;
  team1ManagerName: string;
  team2Id: string;
  team2Seed: number;
  team2Points: number;
  team2UserId: string;
  team2ManagerName: string;
  winnerUserId: string;
}

export interface Season {
  year: number;
  teamCount: number;
  standings: SeasonStandingRow[];
  playoffs: PlayoffGame[];
}

export interface MatchupTeam {
  teamId: string;
  userId: string;
  managerName: string;
  teamName: string;
  points: number;
}

export interface Matchup {
  year: number;
  week: number;
  matchupId: string;
  isPlayoff: boolean;
  roundLabel: string | null;
  bracketType: string | null;
  team1: MatchupTeam;
  team2: MatchupTeam;
  winnerUserId: string | null;
}

export interface DraftPick {
  year: number;
  round: number;
  pick: number;
  teamId: string;
  userId: string;
  managerName: string;
  teamName: string;
  playerId: string;
  playerName: string;
}

export interface TradeAsset {
  fromUserId: string;
  fromManagerName: string;
  toUserId: string;
  toManagerName: string;
  playerId: string;
  playerName: string;
}

export interface Trade {
  year: number;
  transactionDate: string;
  transactionWeek: number;
  ownerUserId: string;
  assets: TradeAsset[];
}

export interface WeeklyTopPerformer {
  year: number;
  week: number;
  teamId: string;
  userId: string;
  managerName: string;
  playerId: string;
  playerName: string;
  pos: string;
  nflTeam: string;
  pts: number;
}

export type SkillPosition = "QB" | "RB" | "WR" | "TE";

export interface PositionBest {
  timeframe: "season" | "week";
  pos: SkillPosition;
  year: number;
  week: number | null;
  playerId: string;
  playerName: string;
  userId: string;
  managerName: string;
  points: number;
}

export interface DraftValuePick {
  year: number;
  round: number;
  pick: number; // overall pick number, for context only — not used in the value calc
  userId: string;
  managerName: string;
  playerId: string;
  playerName: string;
  pos: SkillPosition;
  seasonPoints: number;
  // Both ranks are computed within this player's own position for this draft
  // year only, so "value" never compares e.g. a QB to a TE.
  positionalPick: number; // Nth player at this position taken, by draft order
  positionalFinish: number; // Nth player at this position, by season points
  value: number; // positionalPick - positionalFinish; positive = steal
}

export interface RepeatDraftee {
  userId: string;
  managerName: string;
  playerId: string;
  playerName: string;
  years: number[];
}

export interface BenchWasteRow {
  year: number;
  teamId: string;
  userId: string;
  managerName: string;
  actualPoints: number;
  optimalPoints: number;
  wastedPoints: number;
}

export interface DraftTendency {
  userId: string;
  managerName: string;
  totalPicks: number;
  avgRoundByPos: Record<string, number>;
  byRound: Record<string, Record<string, number>>;
}

export interface VolatilityEntry {
  userId: string;
  managerName: string;
  gamesPlayed: number;
  mean: number;
  stdDev: number;
}

// AI-generated (Claude), cached at build time by scripts/generate-commentary.ts.
// Keyed by year; `games` is keyed by matchupId (regular-season games only).
export interface SeasonCommentary {
  seasonRecap: string;
  games: Record<string, string>;
}

export type Commentary = Record<string, SeasonCommentary>;
