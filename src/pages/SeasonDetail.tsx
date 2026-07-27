import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import seasonsData from "../data/generated/seasons.json";
import matchupsData from "../data/generated/matchups.json";
import draftsData from "../data/generated/drafts.json";
import topPerformersData from "../data/generated/topPerformers.json";
import commentaryData from "../data/generated/commentary.json";
import type { Season, Matchup, DraftPick, WeeklyTopPerformer, PlayoffGame, Commentary } from "../types";
import { computeMatchupRecords, seasonRecapSentence, type RecordHighlight } from "../lib/derive";
import RecordsGrid from "../components/RecordsGrid";

const seasons = seasonsData as Season[];
const matchups = matchupsData as Matchup[];
const drafts = draftsData as DraftPick[];
const topPerformers = topPerformersData as WeeklyTopPerformer[];
const commentary = commentaryData as Commentary;

function weekLabel(week: number): string {
  return week === 0 ? "Final" : `Week ${week}`;
}

function MatchupRow({ m, recap }: { m: Matchup; recap?: string }) {
  const team1Won = m.winnerUserId === m.team1.userId;
  const team2Won = m.winnerUserId === m.team2.userId;
  const scoreLine = (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ fontWeight: team1Won ? 700 : 400, color: team1Won ? "var(--accent)" : undefined }}>
        <Link to={`/team/${m.team1.userId}`}>{m.team1.managerName}</Link>{" "}
        <span className="num" style={{ display: "inline-block", minWidth: 56 }}>
          {m.team1.points.toFixed(1)}
        </span>
      </span>
      <span style={{ fontWeight: team2Won ? 700 : 400, color: team2Won ? "var(--accent)" : undefined }}>
        <span className="num" style={{ display: "inline-block", minWidth: 56 }}>
          {m.team2.points.toFixed(1)}
        </span>{" "}
        <Link to={`/team/${m.team2.userId}`}>{m.team2.managerName}</Link>
      </span>
    </div>
  );

  if (!recap) {
    return <div style={{ padding: "6px 0", borderBottom: "1px solid var(--border)" }}>{scoreLine}</div>;
  }

  return (
    <details style={{ borderBottom: "1px solid var(--border)" }}>
      <summary style={{ padding: "6px 0", cursor: "pointer" }}>{scoreLine}</summary>
      <p className="muted" style={{ fontSize: "0.85rem", padding: "0 0 8px" }}>
        {recap}
      </p>
    </details>
  );
}

function PlayoffBracketSection({ title, games }: { title: string; games: PlayoffGame[] }) {
  if (games.length === 0) return null;

  // Group by round + label rather than just round: a single round can contain
  // several distinctly-labeled games (e.g. round 3 = Fantasy Super Bowl, 3rd
  // Place Game, and 5th Place Game all at once). Games that share an empty
  // label within the same round (e.g. an unlabeled consolation round) are
  // grouped together under a "Round N" fallback.
  const groups = new Map<string, { round: number; label: string; games: PlayoffGame[] }>();
  for (const g of games) {
    const key = g.roundLabel ? g.roundLabel : `round-${g.round}`;
    const label = g.roundLabel || `Round ${g.round}`;
    const group = groups.get(key);
    if (group) {
      group.games.push(g);
    } else {
      groups.set(key, { round: g.round, label, games: [g] });
    }
  }
  const orderedGroups = [...groups.values()].sort((a, b) => a.round - b.round);

  return (
    <div style={{ marginBottom: 16 }}>
      <h3 style={{ marginBottom: 8 }}>{title}</h3>
      <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
        {orderedGroups.map((group) => {
          return (
            <div key={group.label} style={{ minWidth: 220 }}>
              <div className="muted" style={{ fontSize: "0.78rem", textTransform: "uppercase", marginBottom: 6 }}>
                {group.label}
              </div>
              {group.games.map((g, i) => {
                const team1Won = g.winnerUserId === g.team1UserId;
                return (
                  <div key={i} style={{ fontSize: "0.9rem", marginBottom: 6 }}>
                    <div style={{ fontWeight: team1Won ? 700 : 400, color: team1Won ? "var(--accent)" : undefined }}>
                      {g.team1ManagerName} <span className="num">{g.team1Points.toFixed(1)}</span>
                    </div>
                    <div style={{ fontWeight: !team1Won ? 700 : 400, color: !team1Won ? "var(--accent)" : undefined }}>
                      {g.team2ManagerName} <span className="num">{g.team2Points.toFixed(1)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SeasonDetail() {
  const { year: yearParam } = useParams<{ year: string }>();
  const year = Number(yearParam);

  const season = seasons.find((s) => s.year === year);

  const yearMatchups = useMemo(() => matchups.filter((m) => m.year === year), [year]);
  const regularByWeek = useMemo(() => {
    const map = new Map<number, Matchup[]>();
    for (const m of yearMatchups) {
      if (m.isPlayoff) continue;
      const list = map.get(m.week) ?? [];
      list.push(m);
      map.set(m.week, list);
    }
    return map;
  }, [yearMatchups]);

  const playoffGames = useMemo(() => {
    if (!season) return { championship: [], consolation: [] };
    return {
      championship: season.playoffs.filter((g) => g.bracketType === "Championship"),
      consolation: season.playoffs.filter((g) => g.bracketType === "Consolation"),
    };
  }, [season]);

  const topPerformerByWeek = useMemo(() => {
    const map = new Map<number, WeeklyTopPerformer>();
    for (const tp of topPerformers) {
      if (tp.year === year) map.set(tp.week, tp);
    }
    return map;
  }, [year]);

  const records: RecordHighlight[] = useMemo(() => {
    const base = computeMatchupRecords(yearMatchups);
    const yearTop = topPerformers.filter((t) => t.year === year);
    if (yearTop.length > 0) {
      const best = yearTop.reduce((a, b) => (b.pts > a.pts ? b : a));
      base.push({
        label: "Best individual performance",
        value: `${best.pts.toFixed(1)} pts`,
        detail: `${best.playerName} (${best.pos}, ${best.nflTeam}) — ${best.managerName}, Week ${best.week}`,
      });
    }
    return base;
  }, [yearMatchups, year]);

  const yearDrafts = useMemo(() => drafts.filter((d) => d.year === year).sort((a, b) => a.round - b.round || a.pick - b.pick), [year]);
  const draftBoard = useMemo(() => {
    const round1 = yearDrafts.filter((d) => d.round === 1).sort((a, b) => a.pick - b.pick);
    const columns = round1.map((d) => ({ teamId: d.teamId, managerName: d.managerName }));
    const byRoundTeam = new Map<string, DraftPick>();
    let maxRound = 1;
    for (const d of yearDrafts) {
      byRoundTeam.set(`${d.round}-${d.teamId}`, d);
      if (d.round > maxRound) maxRound = d.round;
    }
    return { columns, byRoundTeam, maxRound };
  }, [yearDrafts]);

  if (!season) {
    return (
      <div className="page">
        <h1>Season not found</h1>
        <Link to="/seasons">Back to Seasons</Link>
      </div>
    );
  }

  const champion = season.standings.find((s) => s.rank === 1);
  const runnerUp = season.standings.find((s) => s.rank === 2);
  const weeks = [...regularByWeek.keys()].sort((a, b) => a - b);
  const seasonCommentary = commentary[String(year)];

  return (
    <div className="page">
      <p>
        <Link to="/seasons">&larr; Back to Seasons</Link>
      </p>
      <div className="kicker">Season Story</div>
      <h1>{year} Season</h1>
      <p className="dek">{seasonRecapSentence(season)}</p>
      <p className="muted" style={{ marginTop: -6 }}>
        {season.teamCount} teams
        {champion ? (
          <>
            {" "}
            &middot; Champion: <Link to={`/team/${champion.userId}`}>{champion.managerName}</Link> ({champion.teamName})
          </>
        ) : null}
        {runnerUp ? (
          <>
            {" "}
            &middot; Runner-up: <Link to={`/team/${runnerUp.userId}`}>{runnerUp.managerName}</Link>
          </>
        ) : null}
      </p>

      {seasonCommentary && (
        <div className="card">
          <div className="kicker">The Season, Recapped</div>
          <p style={{ marginBottom: 0 }}>{seasonCommentary.seasonRecap}</p>
          <p className="muted" style={{ fontSize: "0.75rem", marginTop: 8, marginBottom: 0 }}>
            AI-generated recap, based on this season's results.
          </p>
        </div>
      )}

      <div className="card">
        <h2>Season Notables</h2>
        <RecordsGrid records={records} />
      </div>

      <div className="card">
        <h2>Playoff Bracket</h2>
        <PlayoffBracketSection title="Championship" games={playoffGames.championship} />
        <PlayoffBracketSection title="Consolation" games={playoffGames.consolation} />
      </div>

      <div className="card">
        <h2>Weekly Results</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
          {weeks.map((week) => {
            const topPerformer = topPerformerByWeek.get(week);
            return (
              <div key={week}>
                <h3 style={{ fontSize: "1rem", marginBottom: 4 }}>{weekLabel(week)}</h3>
                {regularByWeek.get(week)!.map((m) => (
                  <MatchupRow key={m.matchupId} m={m} recap={seasonCommentary?.games[m.matchupId]} />
                ))}
                {topPerformer && (
                  <div className="muted" style={{ fontSize: "0.78rem", marginTop: 6 }}>
                    Top performer: {topPerformer.playerName} ({topPerformer.pos}, {topPerformer.nflTeam}) &mdash;{" "}
                    {topPerformer.pts.toFixed(1)} pts for {topPerformer.managerName}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <h2>Draft Board</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Rd</th>
                {draftBoard.columns.map((c) => (
                  <th key={c.teamId}>
                    <Link to={`/team/${yearDrafts.find((d) => d.teamId === c.teamId)?.userId ?? ""}`}>
                      {c.managerName}
                    </Link>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: draftBoard.maxRound }, (_, i) => i + 1).map((round) => (
                <tr key={round}>
                  <td>{round}</td>
                  {draftBoard.columns.map((c) => {
                    const pick = draftBoard.byRoundTeam.get(`${round}-${c.teamId}`);
                    return <td key={c.teamId}>{pick ? pick.playerName : "—"}</td>;
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
