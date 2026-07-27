import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import positionLegendsData from "../data/generated/positionLegends.json";
import benchWasteData from "../data/generated/benchWaste.json";
import volatilityData from "../data/generated/volatility.json";
import type { PositionBest, BenchWasteRow, VolatilityEntry, SkillPosition } from "../types";
import { benchWasteByManager } from "../lib/derive";
import RecordsGrid from "../components/RecordsGrid";

const positionLegends = positionLegendsData as PositionBest[];
const benchWaste = benchWasteData as BenchWasteRow[];
const volatility = volatilityData as VolatilityEntry[];

const POSITIONS: SkillPosition[] = ["QB", "RB", "WR", "TE"];

function LegendTable({ title, rows }: { title: string; rows: PositionBest[] }) {
  return (
    <div style={{ flex: "1 1 260px", minWidth: 260 }}>
      <div className="muted" style={{ fontSize: "0.78rem", textTransform: "uppercase", marginBottom: 6 }}>
        {title}
      </div>
      <table>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              <td className="num" style={{ width: 22 }}>
                {i + 1}
              </td>
              <td>
                {r.playerName}
                <div className="muted" style={{ fontSize: "0.78rem" }}>
                  <Link to={`/team/${r.userId}`}>{r.managerName}</Link>, {r.year}
                  {r.week !== null ? ` Week ${r.week}` : ""}
                </div>
              </td>
              <td className="num">{r.points.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type VolSortKey = "managerName" | "gamesPlayed" | "mean" | "stdDev";

export default function Stats() {
  const worstBenchSeason = useMemo(() => [...benchWaste].sort((a, b) => b.wastedPoints - a.wastedPoints)[0], []);
  const benchByManager = useMemo(() => benchWasteByManager(benchWaste), []);

  const mostConsistent = volatility[0];
  const mostVolatile = volatility[volatility.length - 1];

  const [sortKey, setSortKey] = useState<VolSortKey>("stdDev" as VolSortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function onSort(key: VolSortKey) {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sortedVolatility = useMemo(() => {
    const copy = [...volatility];
    copy.sort((a, b) => {
      const cmp = sortKey === "managerName" ? a.managerName.localeCompare(b.managerName) : a[sortKey] - b[sortKey];
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [sortKey, sortDir]);

  return (
    <div className="page">
      <div className="kicker">Advanced Stats</div>
      <h1>Stats</h1>
      <p className="dek">
        The best individual seasons and single weeks at each skill position, who manages a bench well and who
        doesn't, and who you can set your watch by versus who's a coin flip every week.
      </p>

      <div className="card">
        <h2>Position Legends</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Best-ever performances by true position (started players only), across all six seasons.
        </p>
        {POSITIONS.map((pos) => (
          <div key={pos} style={{ marginBottom: 20 }}>
            <h3 style={{ marginBottom: 8 }}>{pos}</h3>
            <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
              <LegendTable
                title="Best Season"
                rows={positionLegends.filter((p) => p.pos === pos && p.timeframe === "season")}
              />
              <LegendTable
                title="Best Week"
                rows={positionLegends.filter((p) => p.pos === pos && p.timeframe === "week")}
              />
            </div>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Bench Management</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Points scored by each manager's bench that season versus what their best possible lineup would have
          scored, summed week by week. Lower is better.
        </p>
        {worstBenchSeason && (
          <div style={{ marginBottom: 16 }}>
            <RecordsGrid
              records={[
                {
                  label: "Worst single season",
                  value: `${worstBenchSeason.wastedPoints.toFixed(1)} pts left on the bench`,
                  detail: `${worstBenchSeason.managerName}, ${worstBenchSeason.year}`,
                },
              ]}
            />
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Manager</th>
                <th className="num">Seasons</th>
                <th className="num">Total Wasted</th>
                <th className="num">Avg / Season</th>
                <th>Worst Season</th>
              </tr>
            </thead>
            <tbody>
              {benchByManager.map((m) => (
                <tr key={m.userId}>
                  <td>
                    <Link to={`/team/${m.userId}`}>{m.managerName}</Link>
                  </td>
                  <td className="num">{m.seasonsPlayed}</td>
                  <td className="num">{m.totalWasted.toFixed(1)}</td>
                  <td className="num">{m.avgWastedPerSeason.toFixed(1)}</td>
                  <td className="num">
                    {m.worstSeason ? `${m.worstSeason.year} (${m.worstSeason.wastedPoints.toFixed(1)})` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Consistency &amp; Volatility</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Mean and week-to-week standard deviation of regular-season scoring, across each manager's whole career.
        </p>
        {mostConsistent && mostVolatile && (
          <div style={{ marginBottom: 16 }}>
            <RecordsGrid
              records={[
                {
                  label: "Most consistent",
                  value: `±${mostConsistent.stdDev.toFixed(1)} pts`,
                  detail: `${mostConsistent.managerName} — averages ${mostConsistent.mean.toFixed(1)} pts/week`,
                },
                {
                  label: "Most volatile",
                  value: `±${mostVolatile.stdDev.toFixed(1)} pts`,
                  detail: `${mostVolatile.managerName} — averages ${mostVolatile.mean.toFixed(1)} pts/week`,
                },
              ]}
            />
          </div>
        )}
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => onSort("managerName")}>
                  Manager{sortKey === "managerName" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
                <th className="sortable num" onClick={() => onSort("gamesPlayed")}>
                  Games{sortKey === "gamesPlayed" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
                <th className="sortable num" onClick={() => onSort("mean")}>
                  Mean{sortKey === "mean" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
                <th className="sortable num" onClick={() => onSort("stdDev")}>
                  Std Dev{sortKey === "stdDev" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedVolatility.map((v) => (
                <tr key={v.userId}>
                  <td>
                    <Link to={`/team/${v.userId}`}>{v.managerName}</Link>
                  </td>
                  <td className="num">{v.gamesPlayed}</td>
                  <td className="num">{v.mean.toFixed(1)}</td>
                  <td className="num">{v.stdDev.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
