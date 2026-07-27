import { useMemo } from "react";
import { Link } from "react-router-dom";
import seasonsData from "../data/generated/seasons.json";
import matchupsData from "../data/generated/matchups.json";
import type { Season, Matchup, SeasonStandingRow } from "../types";
import { computeMatchupRecords, seasonRecapSentence } from "../lib/derive";
import RecordsGrid from "../components/RecordsGrid";

const seasons = seasonsData as Season[];
const matchups = matchupsData as Matchup[];

function rankBadge(row: SeasonStandingRow) {
  if (row.rank === 1) return <span className="badge badge-champ">Champion</span>;
  if (row.rank === 2) return <span className="badge badge-runnerup">Runner-up</span>;
  if (row.madePlayoffs) return <span className="badge badge-playoff">Playoffs</span>;
  return null;
}

export default function LeagueHistory() {
  const records = useMemo(() => computeMatchupRecords(matchups), []);
  const sortedSeasons = [...seasons].sort((a, b) => b.year - a.year);

  return (
    <div className="page">
      <div className="kicker">Est. 2020</div>
      <h1>League History</h1>
      <p className="dek">
        Six seasons of the TBS Fantasy League, from an eight-team startup year to a full twelve-team championship
        bracket. Every season below links out to its full week-by-week story.
      </p>

      <div className="card">
        <h2>League Records</h2>
        <RecordsGrid records={records} />
      </div>

      {sortedSeasons.map((season) => (
        <div className="card" key={season.year}>
          <h2>
            {season.year} <span className="muted">&middot; {season.teamCount} teams</span>{" "}
            <Link to={`/season/${season.year}`} style={{ fontSize: "0.85rem", fontWeight: 400 }}>
              View full season &rarr;
            </Link>
          </h2>
          <p className="muted" style={{ marginTop: 0 }}>
            {seasonRecapSentence(season)}
          </p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Manager</th>
                  <th>Team</th>
                  <th className="num">Record</th>
                  <th className="num">PF</th>
                  <th className="num">PA</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {season.standings.map((row) => (
                  <tr key={row.teamId}>
                    <td>{row.rank}</td>
                    <td>
                      <Link to={`/team/${row.userId}`}>{row.managerName}</Link>
                    </td>
                    <td>{row.teamName}</td>
                    <td className="num">
                      {row.wins}-{row.losses}
                      {row.draws > 0 ? `-${row.draws}` : ""}
                    </td>
                    <td className="num">{row.pointsFor.toFixed(1)}</td>
                    <td className="num">{row.pointsAgainst.toFixed(1)}</td>
                    <td>{rankBadge(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
