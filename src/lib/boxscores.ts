import type { MatchupBoxScores } from "../types";

// Box score files are big (one per year, not bundled into the main JS chunk).
// import.meta.glob registers a lazy loader per file; each becomes its own
// chunk that only downloads when a game's box score is actually expanded.
const boxScoreModules = import.meta.glob<{ default: MatchupBoxScores }>("../data/generated/boxscores/*.json");

const cache = new Map<number, Promise<MatchupBoxScores>>();

export function getBoxScoresForYear(year: number): Promise<MatchupBoxScores> {
  const cached = cache.get(year);
  if (cached) return cached;

  const path = `../data/generated/boxscores/${year}.json`;
  const loader = boxScoreModules[path];
  const promise = loader ? loader().then((m) => m.default) : Promise.resolve({} as MatchupBoxScores);
  cache.set(year, promise);
  return promise;
}
