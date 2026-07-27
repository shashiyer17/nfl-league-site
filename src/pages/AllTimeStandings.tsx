import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import managersData from "../data/generated/managers.json";
import seasonsData from "../data/generated/seasons.json";
import type { Manager, Season } from "../types";
import { computeCareerStats, formatRecord, type CareerStats } from "../lib/derive";

const managers = managersData as Manager[];
const seasons = seasonsData as Season[];

type Row = CareerStats & { winPct: number };

type SortKey =
  | "managerName"
  | "seasonsPlayed"
  | "wins"
  | "winPct"
  | "pointsFor"
  | "pointsAgainst"
  | "championships"
  | "runnerUps"
  | "playoffAppearances"
  | "bestFinish"
  | "worstFinish";

const columns: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "managerName", label: "Manager" },
  { key: "seasonsPlayed", label: "Seasons", numeric: true },
  { key: "wins", label: "Record", numeric: true },
  { key: "winPct", label: "Win %", numeric: true },
  { key: "pointsFor", label: "PF", numeric: true },
  { key: "pointsAgainst", label: "PA", numeric: true },
  { key: "championships", label: "Titles", numeric: true },
  { key: "runnerUps", label: "Runner-ups", numeric: true },
  { key: "playoffAppearances", label: "Playoffs", numeric: true },
  { key: "bestFinish", label: "Best Finish", numeric: true },
  { key: "worstFinish", label: "Worst Finish", numeric: true },
];

export default function AllTimeStandings() {
  const rows: Row[] = useMemo(() => {
    const stats = computeCareerStats(managers, seasons);
    return stats.map((s) => ({
      ...s,
      winPct: s.wins + s.losses + s.draws > 0 ? s.wins / (s.wins + s.losses + s.draws) : 0,
    }));
  }, []);

  const [sortKey, setSortKey] = useState<SortKey>("championships" as SortKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "bestFinish" || key === "worstFinish" ? "asc" : "desc");
    }
  }

  const sorted = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) => {
      let cmp: number;
      if (sortKey === "managerName") {
        cmp = a.managerName.localeCompare(b.managerName);
      } else {
        cmp = (a[sortKey] as number) - (b[sortKey] as number);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const leader = rows.find((r) => r.championships > 0);

  return (
    <div className="page">
      <div className="kicker">Career Leaderboard</div>
      <h1>All-Time Standings</h1>
      <p className="dek">
        Every manager's record across every season they've fielded a team.
        {leader
          ? ` ${leader.managerName} leads the league with ${leader.championships} title${leader.championships === 1 ? "" : "s"}.`
          : ""}{" "}
        Click any column to re-sort.
      </p>

      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={`sortable ${col.numeric ? "num" : ""}`}
                    onClick={() => onSort(col.key)}
                  >
                    {col.label}
                    {sortKey === col.key ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((row) => (
                <tr key={row.userId}>
                  <td>
                    <Link to={`/team/${row.userId}`}>{row.managerName}</Link>
                  </td>
                  <td className="num">{row.seasonsPlayed}</td>
                  <td className="num">{formatRecord(row.wins, row.losses, row.draws)}</td>
                  <td className="num">
                    <span className="win-bar-track">
                      <span className="win-bar-fill" style={{ width: `${(row.winPct * 100).toFixed(0)}%` }} />
                    </span>
                    {(row.winPct * 100).toFixed(1)}%
                  </td>
                  <td className="num">{row.pointsFor.toFixed(1)}</td>
                  <td className="num">{row.pointsAgainst.toFixed(1)}</td>
                  <td className="num" style={row.championships > 0 ? { color: "var(--accent)", fontWeight: 700 } : undefined}>
                    {row.championships}
                  </td>
                  <td className="num">{row.runnerUps}</td>
                  <td className="num">{row.playoffAppearances}</td>
                  <td className="num">{row.bestFinish}</td>
                  <td className="num">{row.worstFinish}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
