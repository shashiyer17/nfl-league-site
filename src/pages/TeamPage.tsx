import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import managersData from "../data/generated/managers.json";
import seasonsData from "../data/generated/seasons.json";
import draftsData from "../data/generated/drafts.json";
import tradesData from "../data/generated/trades.json";
import benchWasteData from "../data/generated/benchWaste.json";
import volatilityData from "../data/generated/volatility.json";
import draftValueData from "../data/generated/draftValue.json";
import draftTendenciesData from "../data/generated/draftTendencies.json";
import type {
  Manager,
  Season,
  DraftPick,
  Trade,
  BenchWasteRow,
  VolatilityEntry,
  DraftValuePick,
  DraftTendency,
  SkillPosition,
} from "../types";
import {
  computeCareerStats,
  formatRecord,
  careerRecapSentence,
  benchWasteByManager,
  draftValueForManagerByPosition,
  draftTendencySummary,
} from "../lib/derive";
import StatTiles from "../components/StatTiles";

const managers = managersData as Manager[];
const seasons = seasonsData as Season[];
const drafts = draftsData as DraftPick[];
const trades = tradesData as Trade[];
const benchWaste = benchWasteData as BenchWasteRow[];
const volatility = volatilityData as VolatilityEntry[];
const draftValue = draftValueData as DraftValuePick[];
const draftTendencies = draftTendenciesData as unknown as DraftTendency[];

function rankLabel(rank: number, madePlayoffs: boolean) {
  if (rank === 1) return <span className="badge badge-champ">Champion</span>;
  if (rank === 2) return <span className="badge badge-runnerup">Runner-up</span>;
  if (madePlayoffs) return <span className="badge badge-playoff">Playoffs</span>;
  return <span className="muted">&mdash;</span>;
}

export default function TeamPage() {
  const { userId } = useParams<{ userId: string }>();

  const manager = managers.find((m) => m.userId === userId);

  const career = useMemo(() => {
    if (!manager) return null;
    return computeCareerStats(managers, seasons).find((c) => c.userId === userId) ?? null;
  }, [manager, userId]);

  const seasonRows = useMemo(() => {
    if (!userId) return [];
    return seasons
      .map((season) => ({
        year: season.year,
        row: season.standings.find((r) => r.userId === userId) ?? null,
      }))
      .filter((s): s is { year: number; row: NonNullable<typeof s.row> } => s.row !== null)
      .sort((a, b) => b.year - a.year);
  }, [userId]);

  const draftsByYear = useMemo(() => {
    if (!userId) return new Map<number, DraftPick[]>();
    const map = new Map<number, DraftPick[]>();
    for (const pick of drafts) {
      if (pick.userId !== userId) continue;
      const list = map.get(pick.year) ?? [];
      list.push(pick);
      map.set(pick.year, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.round - b.round || a.pick - b.pick);
    return map;
  }, [userId]);

  const myTrades = useMemo(() => {
    if (!userId) return [];
    return trades
      .filter((t) => t.assets.some((a) => a.fromUserId === userId || a.toUserId === userId))
      .sort((a, b) => b.transactionDate.localeCompare(a.transactionDate));
  }, [userId]);

  const myBenchWaste = useMemo(() => {
    if (!userId) return null;
    return benchWasteByManager(benchWaste).find((b) => b.userId === userId) ?? null;
  }, [userId]);

  const myVolatility = useMemo(() => volatility.find((v) => v.userId === userId) ?? null, [userId]);

  const myDraftValueByPos = useMemo(
    () => (userId ? draftValueForManagerByPosition(draftValue, userId) : {}),
    [userId]
  );

  const myTendency = useMemo(() => draftTendencies.find((t) => t.userId === userId) ?? null, [userId]);

  if (!manager || !career) {
    return (
      <div className="page">
        <h1>Manager not found</h1>
        <Link to="/standings">Back to All-Time Standings</Link>
      </div>
    );
  }

  const draftYears = [...draftsByYear.keys()].sort((a, b) => b - a);

  return (
    <div className="page">
      <div className="kicker">Manager Profile</div>
      <h1>{manager.managerName}</h1>
      <p className="dek">
        {manager.seasons.map((s, i) => (
          <span key={s.year}>
            {i > 0 ? " · " : ""}
            {s.year}: {s.teamName}
          </span>
        ))}
      </p>

      <div className="card">
        <h2>Career Summary</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          {careerRecapSentence(career)}
        </p>
        <StatTiles
          stats={[
            { label: "Seasons", value: String(career.seasonsPlayed) },
            { label: "Record", value: formatRecord(career.wins, career.losses, career.draws) },
            { label: "Points For", value: career.pointsFor.toFixed(1) },
            { label: "Points Against", value: career.pointsAgainst.toFixed(1) },
            { label: "Championships", value: String(career.championships), accent: career.championships > 0 },
            { label: "Runner-ups", value: String(career.runnerUps) },
            { label: "Playoff Appearances", value: String(career.playoffAppearances) },
            { label: "Best Finish", value: `#${career.bestFinish}` },
            { label: "Worst Finish", value: `#${career.worstFinish}` },
            ...(myBenchWaste ? [{ label: "Bench Pts Wasted", value: myBenchWaste.totalWasted.toFixed(1) }] : []),
            ...(myVolatility ? [{ label: "Scoring Std Dev", value: `±${myVolatility.stdDev.toFixed(1)}` }] : []),
          ]}
        />
      </div>

      <div className="card">
        <h2>Season by Season</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Team</th>
                <th className="num">Final Rank</th>
                <th className="num">Reg. Record</th>
                <th className="num">Reg. Rank</th>
                <th className="num">PF</th>
                <th className="num">PA</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {seasonRows.map(({ year, row }) => (
                <tr key={year}>
                  <td>{year}</td>
                  <td>{row.teamName}</td>
                  <td className="num">#{row.rank}</td>
                  <td className="num">{formatRecord(row.wins, row.losses, row.draws)}</td>
                  <td className="num">#{row.regularSeasonRank}</td>
                  <td className="num">{row.pointsFor.toFixed(1)}</td>
                  <td className="num">{row.pointsAgainst.toFixed(1)}</td>
                  <td>{rankLabel(row.rank, row.madePlayoffs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Draft History</h2>
        {myTendency && draftTendencySummary(myTendency) && (
          <p className="muted" style={{ marginTop: 0 }}>
            {draftTendencySummary(myTendency)}
          </p>
        )}
        {Object.keys(myDraftValueByPos).length > 0 && (
          <div className="table-scroll" style={{ marginBottom: 16 }}>
            <table>
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Best Steal</th>
                  <th className="num">Value</th>
                  <th>Worst Bust</th>
                  <th className="num">Value</th>
                </tr>
              </thead>
              <tbody>
                {(["QB", "RB", "WR", "TE"] as SkillPosition[]).map((pos) => {
                  const entry = myDraftValueByPos[pos];
                  if (!entry) return null;
                  return (
                    <tr key={pos}>
                      <td>{pos}</td>
                      <td>
                        {entry.best.playerName} <span className="muted">({entry.best.year})</span>
                      </td>
                      <td className="num" style={{ color: entry.best.value > 0 ? "var(--accent)" : undefined }}>
                        {entry.best.value > 0 ? "+" : ""}
                        {entry.best.value}
                      </td>
                      <td>
                        {entry.worst.playerName} <span className="muted">({entry.worst.year})</span>
                      </td>
                      <td className="num">{entry.worst.value}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {draftYears.map((year) => (
          <details key={year} style={{ marginBottom: 8 }}>
            <summary style={{ cursor: "pointer", fontWeight: 600, padding: "4px 0" }}>{year}</summary>
            <table>
              <thead>
                <tr>
                  <th>Round</th>
                  <th>Pick</th>
                  <th>Player</th>
                </tr>
              </thead>
              <tbody>
                {draftsByYear.get(year)!.map((pick) => (
                  <tr key={`${pick.round}-${pick.pick}`}>
                    <td>{pick.round}</td>
                    <td>{pick.pick}</td>
                    <td>{pick.playerName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        ))}
      </div>

      <div className="card">
        <h2>Trades</h2>
        {myTrades.length === 0 && <p className="muted">No trades on record.</p>}
        {myTrades.map((trade, i) => {
          const sent = trade.assets.filter((a) => a.fromUserId === userId);
          const received = trade.assets.filter((a) => a.toUserId === userId);
          return (
            <div key={i} style={{ borderTop: i > 0 ? "1px solid var(--border)" : undefined, padding: "10px 0" }}>
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                {trade.year} · Week {trade.transactionWeek} · {new Date(trade.transactionDate).toLocaleDateString()}
              </div>
              {received.length > 0 && (
                <div>
                  Received: {received.map((a) => `${a.playerName} (from ${a.fromManagerName})`).join(", ")}
                </div>
              )}
              {sent.length > 0 && (
                <div>Sent: {sent.map((a) => `${a.playerName} (to ${a.toManagerName})`).join(", ")}</div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
