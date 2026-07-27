import { Link, useParams } from "react-router-dom";
import tradesData from "../data/generated/trades.json";
import type { Trade } from "../types";
import { tradeSides } from "../lib/derive";

const trades = tradesData as Trade[];

function TradeCard({ trade }: { trade: Trade }) {
  const { sides, droppedToFreeAgency } = tradeSides(trade);
  const bestSide = sides.length === 2 ? sides.reduce((a, b) => (b.netPoints > a.netPoints ? b : a)) : null;

  return (
    <div className="card">
      <div className="muted" style={{ fontSize: "0.82rem", marginBottom: 10 }}>
        Week {trade.transactionWeek} &middot; {new Date(trade.transactionDate).toLocaleDateString()}
      </div>
      <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
        {sides.map((side) => (
          <div key={side.userId} style={{ flex: "1 1 260px", minWidth: 240 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4 }}>
              <Link to={`/team/${side.userId}`} style={{ fontWeight: 700 }}>
                {side.managerName}
              </Link>
              {bestSide && bestSide.userId === side.userId && (
                <span className="badge badge-champ">Won it</span>
              )}
            </div>
            {side.received.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <span className="muted">Received:</span>{" "}
                {side.received.map((a, i) => (
                  <span key={a.playerId}>
                    {i > 0 && ", "}
                    {a.playerName} <span className="num">({a.postTradePoints.toFixed(1)} pts after)</span>
                  </span>
                ))}
              </div>
            )}
            {side.sent.length > 0 && (
              <div style={{ marginBottom: 4 }}>
                <span className="muted">Sent:</span>{" "}
                {side.sent.map((a, i) => (
                  <span key={a.playerId}>
                    {i > 0 && ", "}
                    {a.playerName} <span className="num">({a.postTradePoints.toFixed(1)} pts after)</span>
                  </span>
                ))}
              </div>
            )}
            <div className="muted" style={{ fontSize: "0.82rem" }}>
              Net: {side.netPoints > 0 ? "+" : ""}
              {side.netPoints.toFixed(1)} pts
            </div>
          </div>
        ))}
      </div>
      {droppedToFreeAgency.length > 0 && (
        <div className="muted" style={{ fontSize: "0.78rem", marginTop: 10 }}>
          Also dropped to free agency: {droppedToFreeAgency.map((a) => a.playerName).join(", ")}
        </div>
      )}
    </div>
  );
}

export default function TradeYearDetail() {
  const { year: yearParam } = useParams<{ year: string }>();
  const year = Number(yearParam);

  const yearTrades = trades.filter((t) => t.year === year).sort((a, b) => a.transactionDate.localeCompare(b.transactionDate));

  return (
    <div className="page">
      <p>
        <Link to="/trades">&larr; Back to Trades</Link>
      </p>
      <div className="kicker">Trade Log</div>
      <h1>{year} Trades</h1>
      <p className="dek">
        "Pts after" is how many points that player scored (on any roster) for the rest of the {year} season, from the
        week after the trade onward — the honest scoreboard for who actually won each deal.
      </p>

      {yearTrades.length === 0 && <p className="muted">No trades recorded for {year}.</p>}
      {yearTrades.map((trade, i) => (
        <TradeCard key={i} trade={trade} />
      ))}
    </div>
  );
}
