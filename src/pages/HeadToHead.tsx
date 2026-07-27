import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import managersData from "../data/generated/managers.json";
import matchupsData from "../data/generated/matchups.json";
import type { Manager, Matchup } from "../types";
import { computeHeadToHead, getHeadToHead, managerNameByUserId } from "../lib/derive";
import GameBoxScore from "../components/GameBoxScore";

const managers = managersData as Manager[];
const matchups = matchupsData as Matchup[];

export default function HeadToHead() {
  const { userIdA, userIdB } = useParams<{ userIdA?: string; userIdB?: string }>();
  const h2hMap = useMemo(() => computeHeadToHead(matchups), []);

  if (userIdA && userIdB) {
    return <HeadToHeadDetail userIdA={userIdA} userIdB={userIdB} h2hMap={h2hMap} />;
  }
  return <HeadToHeadMatrix h2hMap={h2hMap} />;
}

function HeadToHeadMatrix({ h2hMap }: { h2hMap: ReturnType<typeof computeHeadToHead> }) {
  return (
    <div className="page">
      <div className="kicker">Rivalries</div>
      <h1>Head-to-Head</h1>
      <p className="dek">
        Every manager's all-time record against every other manager, regular season and playoffs combined. Read a
        row as that manager's record against the column; click any cell for the full game-by-game history.
      </p>
      <div className="card">
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th></th>
                {managers.map((m) => (
                  <th key={m.userId}>{m.managerName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {managers.map((rowManager) => (
                <tr key={rowManager.userId}>
                  <th style={{ textTransform: "none" }}>{rowManager.managerName}</th>
                  {managers.map((colManager) => {
                    if (colManager.userId === rowManager.userId) {
                      return (
                        <td key={colManager.userId} className="num muted">
                          &mdash;
                        </td>
                      );
                    }
                    const rec = getHeadToHead(h2hMap, rowManager.userId, colManager.userId);
                    if (!rec) {
                      return (
                        <td key={colManager.userId} className="num muted">
                          &ndash;
                        </td>
                      );
                    }
                    const rowIsA = rec.userIdA === rowManager.userId;
                    const rowWins = rowIsA ? rec.aWins : rec.bWins;
                    const colWins = rowIsA ? rec.bWins : rec.aWins;
                    return (
                      <td key={colManager.userId} className="num">
                        <Link to={`/h2h/${rowManager.userId}/${colManager.userId}`}>
                          {rowWins}-{colWins}
                          {rec.ties > 0 ? `-${rec.ties}` : ""}
                        </Link>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function HeadToHeadDetail({
  userIdA,
  userIdB,
  h2hMap,
}: {
  userIdA: string;
  userIdB: string;
  h2hMap: ReturnType<typeof computeHeadToHead>;
}) {
  const nameByUserId = useMemo(() => managerNameByUserId(managers), []);
  const rec = getHeadToHead(h2hMap, userIdA, userIdB);
  const nameA = nameByUserId.get(userIdA) ?? "Unknown";
  const nameB = nameByUserId.get(userIdB) ?? "Unknown";

  if (!rec) {
    return (
      <div className="page">
        <h1>
          {nameA} vs {nameB}
        </h1>
        <p className="muted">These managers have never played each other.</p>
        <Link to="/h2h">&larr; Back to Head-to-Head</Link>
      </div>
    );
  }

  const aWins = rec.userIdA === userIdA ? rec.aWins : rec.bWins;
  const bWins = rec.userIdA === userIdA ? rec.bWins : rec.aWins;

  return (
    <div className="page">
      <p>
        <Link to="/h2h">&larr; Back to Head-to-Head</Link>
      </p>
      <div className="kicker">Rivalry</div>
      <h1>
        {nameA} vs {nameB}
      </h1>
      <p className="dek">
        {nameA} {aWins === bWins ? "is tied with" : aWins > bWins ? "leads" : "trails"} {nameB} {aWins}-{bWins}
        {rec.ties > 0 ? `-${rec.ties}` : ""} across {rec.meetings.length} all-time meetings.
      </p>

      <div className="card">
        {rec.meetings.map((m: Matchup) => {
          const teamA = m.team1.userId === userIdA ? m.team1 : m.team2;
          const teamB = m.team1.userId === userIdA ? m.team2 : m.team1;
          const aWonThis = m.winnerUserId === teamA.userId;
          const bWonThis = m.winnerUserId === teamB.userId;
          return (
            <div key={m.matchupId} style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
              <div className="muted" style={{ fontSize: "0.78rem" }}>
                {m.year} &middot; {m.isPlayoff ? m.roundLabel : `Week ${m.week}`}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ fontWeight: aWonThis ? 700 : 400, color: aWonThis ? "var(--accent)" : undefined }}>
                  {nameA}{" "}
                  <span className="num" style={{ display: "inline-block", minWidth: 56 }}>
                    {teamA.points.toFixed(1)}
                  </span>
                </span>
                <span style={{ fontWeight: bWonThis ? 700 : 400, color: bWonThis ? "var(--accent)" : undefined }}>
                  <span className="num" style={{ display: "inline-block", minWidth: 56 }}>
                    {teamB.points.toFixed(1)}
                  </span>{" "}
                  {nameB}
                </span>
              </div>
              <GameBoxScore matchupId={m.matchupId} year={m.year} team1={m.team1} team2={m.team2} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
