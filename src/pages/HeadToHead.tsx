import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import managersData from "../data/generated/managers.json";
import matchupsData from "../data/generated/matchups.json";
import type { Manager, Matchup } from "../types";
import { computeHeadToHead, getHeadToHead, managerNameByUserId } from "../lib/derive";

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
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th>Week</th>
                <th>Round</th>
                <th className="num">{nameA}</th>
                <th className="num">{nameB}</th>
                <th>Winner</th>
              </tr>
            </thead>
            <tbody>
              {rec.meetings.map((m: Matchup) => {
                const teamA = m.team1.userId === userIdA ? m.team1 : m.team2;
                const teamB = m.team1.userId === userIdA ? m.team2 : m.team1;
                const winnerName = m.winnerUserId ? nameByUserId.get(m.winnerUserId) : "Tie";
                return (
                  <tr key={m.matchupId}>
                    <td>{m.year}</td>
                    <td>{m.week}</td>
                    <td>{m.isPlayoff ? m.roundLabel : "Regular Season"}</td>
                    <td className="num">{teamA.points.toFixed(1)}</td>
                    <td className="num">{teamB.points.toFixed(1)}</td>
                    <td>{winnerName}</td>
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
