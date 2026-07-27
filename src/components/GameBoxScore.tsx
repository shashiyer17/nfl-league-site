import { useState } from "react";
import type { BoxScorePlayer, BoxScoreTeam, MatchupBoxScores } from "../types";
import { getBoxScoresForYear } from "../lib/boxscores";

function formatStatLine(truePos: string, stats: Record<string, number>): string {
  const parts: string[] = [];

  if (stats.pass_yd) parts.push(`${stats.pass_yd} pass yd`);
  if (stats.pass_td) parts.push(`${stats.pass_td} pass TD`);
  if (stats.pass_int) parts.push(`${stats.pass_int} INT thrown`);
  if (stats.rush_yd) parts.push(`${stats.rush_yd} rush yd`);
  if (stats.rush_td) parts.push(`${stats.rush_td} rush TD`);
  if (stats.rec) parts.push(`${stats.rec} rec`);
  if (stats.rec_yd) parts.push(`${stats.rec_yd} rec yd`);
  if (stats.rec_td) parts.push(`${stats.rec_td} rec TD`);
  if (stats.fum_lost) parts.push(`${stats.fum_lost} fum lost`);

  const fgMade = Object.entries(stats).filter(([k, v]) => k.startsWith("fgm_") && v);
  if (fgMade.length > 0) {
    parts.push(fgMade.map(([k, v]) => `${v} FG(${k.replace("fgm_", "")})`).join(", "));
  }
  if (stats.xpm) parts.push(`${stats.xpm} XP`);

  if (truePos === "DEF") {
    if (stats.sack) parts.push(`${stats.sack} sack`);
    if (stats.int) parts.push(`${stats.int} INT`);
    if (stats.ff) parts.push(`${stats.ff} FF`);
    if (stats.fum_rec) parts.push(`${stats.fum_rec} FR`);
    if (stats.def_td) parts.push(`${stats.def_td} TD`);
    if (stats.safe) parts.push(`${stats.safe} safety`);
    if (stats.pts_allow !== undefined) parts.push(`${stats.pts_allow} pts allowed`);
  }

  return parts.join(", ");
}

function PlayerRow({ p }: { p: BoxScorePlayer }) {
  const statLine = formatStatLine(p.truePos, p.stats);
  return (
    <div style={{ padding: "4px 0", borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.85rem", gap: 8 }}>
        <span>
          {p.playerName} <span className="muted">({p.truePos}, {p.nflTeam})</span>
        </span>
        <span className="num">{p.pts.toFixed(1)}</span>
      </div>
      {statLine && (
        <div className="muted" style={{ fontSize: "0.72rem" }}>
          {statLine}
        </div>
      )}
    </div>
  );
}

function RosterGroup({ label, players }: { label: string; players: BoxScorePlayer[] }) {
  if (players.length === 0) return null;
  return (
    <>
      <div className="muted" style={{ fontSize: "0.68rem", textTransform: "uppercase", letterSpacing: "0.05em", marginTop: 10 }}>
        {label}
      </div>
      {players.map((p) => (
        <PlayerRow key={p.playerId} p={p} />
      ))}
    </>
  );
}

function TeamColumn({ managerName, team }: { managerName: string; team: BoxScoreTeam }) {
  return (
    <div style={{ flex: "1 1 300px", minWidth: 260 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", flexWrap: "wrap", gap: 6 }}>
        <strong>{managerName}</strong>
        <span className="muted" style={{ fontSize: "0.76rem" }}>
          {team.actual.toFixed(1)} actual / {team.optimal.toFixed(1)} optimal
          {team.wasted > 0.05 && (
            <>
              {" "}
              &middot; <span style={{ color: "var(--accent)" }}>{team.wasted.toFixed(1)} left on bench</span>
            </>
          )}
        </span>
      </div>
      <RosterGroup label="Starters" players={team.starters} />
      <RosterGroup label="Bench" players={team.bench} />
      <RosterGroup label="IR" players={team.reserve} />
    </div>
  );
}

export default function GameBoxScore({
  matchupId,
  year,
  team1,
  team2,
}: {
  matchupId: string;
  year: number;
  team1: { teamId: string; managerName: string };
  team2: { teamId: string; managerName: string };
}) {
  const [state, setState] = useState<"idle" | "loading" | "loaded" | "missing">("idle");
  const [matchupData, setMatchupData] = useState<MatchupBoxScores[string] | null>(null);

  async function handleToggle(e: React.SyntheticEvent<HTMLDetailsElement>) {
    if (!e.currentTarget.open || state !== "idle") return;
    setState("loading");
    const yearData = await getBoxScoresForYear(year);
    const found = yearData[matchupId];
    if (!found) {
      setState("missing");
      return;
    }
    setMatchupData(found);
    setState("loaded");
  }

  return (
    <details onToggle={handleToggle} style={{ marginTop: 4, marginBottom: 8 }}>
      <summary className="muted" style={{ fontSize: "0.76rem", cursor: "pointer" }}>
        Box score
      </summary>
      <div style={{ padding: "8px 0 4px" }}>
        {state === "loading" && <p className="muted">Loading&hellip;</p>}
        {state === "missing" && <p className="muted">Detailed box score not available for this game.</p>}
        {state === "loaded" && matchupData && (
          <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
            {matchupData[team1.teamId] && <TeamColumn managerName={team1.managerName} team={matchupData[team1.teamId]} />}
            {matchupData[team2.teamId] && <TeamColumn managerName={team2.managerName} team={matchupData[team2.teamId]} />}
          </div>
        )}
      </div>
    </details>
  );
}
