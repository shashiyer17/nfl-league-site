import { Link } from "react-router-dom";
import tradesData from "../data/generated/trades.json";
import type { Trade } from "../types";

const trades = tradesData as Trade[];

const YEARS = [2020, 2021, 2022, 2023, 2024, 2025];

export default function TradesIndex() {
  const byYear = new Map<number, Trade[]>();
  for (const t of trades) {
    const list = byYear.get(t.year) ?? [];
    list.push(t);
    byYear.set(t.year, list);
  }

  const years = [...YEARS].reverse();

  return (
    <div className="page">
      <div className="kicker">Trade Log</div>
      <h1>Trades</h1>
      <p className="dek">
        Every trade the league has made, organized by season. Each deal shows what came back afterward, so you can
        see who actually won it in hindsight.
      </p>

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Season</th>
                <th className="num">Trades</th>
              </tr>
            </thead>
            <tbody>
              {years.map((year) => (
                <tr key={year}>
                  <td>
                    <Link to={`/trades/${year}`} style={{ fontWeight: 600 }}>
                      {year}
                    </Link>
                  </td>
                  <td className="num">{byYear.get(year)?.length ?? 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
