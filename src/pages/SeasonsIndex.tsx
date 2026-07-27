import { Link } from "react-router-dom";
import seasonsData from "../data/generated/seasons.json";
import type { Season } from "../types";

const seasons = seasonsData as Season[];

export default function SeasonsIndex() {
  const sorted = [...seasons].sort((a, b) => b.year - a.year);

  return (
    <div className="page">
      <div className="kicker">Season Archive</div>
      <h1>Seasons</h1>
      <p className="dek">
        Pick a year to open its full story: every regular-season week, the playoff bracket, the draft board, and
        that season's standout performances.
      </p>

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Season</th>
                <th>Teams</th>
                <th>Champion</th>
                <th>Runner-up</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((season) => {
                const champion = season.standings.find((s) => s.rank === 1);
                const runnerUp = season.standings.find((s) => s.rank === 2);
                return (
                  <tr key={season.year}>
                    <td>
                      <Link to={`/season/${season.year}`} style={{ fontWeight: 600 }}>
                        {season.year}
                      </Link>
                    </td>
                    <td>{season.teamCount}</td>
                    <td>{champion ? `${champion.managerName} (${champion.teamName})` : "—"}</td>
                    <td>{runnerUp ? `${runnerUp.managerName} (${runnerUp.teamName})` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
