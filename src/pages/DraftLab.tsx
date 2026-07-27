import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import draftValueData from "../data/generated/draftValue.json";
import repeatDrafteesData from "../data/generated/repeatDraftees.json";
import draftTendenciesData from "../data/generated/draftTendencies.json";
import type { DraftValuePick, RepeatDraftee, DraftTendency, SkillPosition } from "../types";
import { topStealsByPosition, topBustsByPosition } from "../lib/derive";
import RecordsGrid from "../components/RecordsGrid";

const draftValue = draftValueData as DraftValuePick[];
const repeatDraftees = repeatDrafteesData as RepeatDraftee[];
const draftTendencies = draftTendenciesData as unknown as DraftTendency[];

const SKILL_POSITIONS: SkillPosition[] = ["QB", "RB", "WR", "TE"];
const TENDENCY_POS_ORDER = ["QB", "RB", "WR", "TE", "K", "DEF"];

type SortKey = "managerName" | "totalPicks" | (typeof TENDENCY_POS_ORDER)[number];

function DraftValueRow({ pick, showSign }: { pick: DraftValuePick; showSign?: boolean }) {
  return (
    <tr>
      <td>{pick.year}</td>
      <td className="num">{pick.pick}</td>
      <td>{pick.playerName}</td>
      <td>
        <Link to={`/team/${pick.userId}`}>{pick.managerName}</Link>
      </td>
      <td className="num">{pick.seasonPoints.toFixed(1)}</td>
      <td className="num">#{pick.positionalPick}</td>
      <td className="num">#{pick.positionalFinish}</td>
      <td className="num" style={{ color: pick.value > 0 ? "var(--accent)" : undefined, fontWeight: 600 }}>
        {showSign && pick.value > 0 ? "+" : ""}
        {pick.value}
      </td>
    </tr>
  );
}

function PositionValueCard({ pos }: { pos: SkillPosition }) {
  const steals = topStealsByPosition(draftValue, pos, 5);
  const busts = topBustsByPosition(draftValue, pos, 5);
  const best = steals[0];
  const worst = busts[0];

  return (
    <div className="card">
      <h2>{pos} Draft Value</h2>
      {best && worst && (
        <div style={{ marginBottom: 16 }}>
          <RecordsGrid
            records={[
              {
                label: "Biggest steal",
                value: `+${best.value}`,
                detail: `${best.playerName} — pick ${best.pick} by ${best.managerName}, ${best.year} (drafted #${best.positionalPick} at ${pos}, finished #${best.positionalFinish})`,
              },
              {
                label: "Biggest bust",
                value: `${worst.value}`,
                detail: `${worst.playerName} — pick ${worst.pick} by ${worst.managerName}, ${worst.year} (drafted #${worst.positionalPick} at ${pos}, finished #${worst.positionalFinish})`,
              },
            ]}
          />
        </div>
      )}
      <div style={{ marginBottom: 20 }}>
        <div className="muted" style={{ fontSize: "0.78rem", textTransform: "uppercase", marginBottom: 6 }}>
          Top Steals
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th className="num">Pick</th>
                <th>Player</th>
                <th>Manager</th>
                <th className="num">Pts</th>
                <th className="num">Drafted</th>
                <th className="num">Finished</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {steals.map((p) => (
                <DraftValueRow key={`${p.year}-${p.pick}`} pick={p} showSign />
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div>
        <div className="muted" style={{ fontSize: "0.78rem", textTransform: "uppercase", marginBottom: 6 }}>
          Top Busts
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Year</th>
                <th className="num">Pick</th>
                <th>Player</th>
                <th>Manager</th>
                <th className="num">Pts</th>
                <th className="num">Drafted</th>
                <th className="num">Finished</th>
                <th className="num">Value</th>
              </tr>
            </thead>
            <tbody>
              {busts.map((p) => (
                <DraftValueRow key={`${p.year}-${p.pick}`} pick={p} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function DraftLab() {
  const [sortKey, setSortKey] = useState<SortKey>("managerName");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  function onSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "managerName" ? "asc" : "desc");
    }
  }

  const sortedTendencies = useMemo(() => {
    const copy = [...draftTendencies];
    copy.sort((a, b) => {
      let cmp: number;
      if (sortKey === "managerName") cmp = a.managerName.localeCompare(b.managerName);
      else if (sortKey === "totalPicks") cmp = a.totalPicks - b.totalPicks;
      else {
        const av = a.avgRoundByPos[sortKey] ?? Infinity;
        const bv = b.avgRoundByPos[sortKey] ?? Infinity;
        cmp = av - bv;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return copy;
  }, [sortKey, sortDir]);

  return (
    <div className="page">
      <div className="kicker">Draft Analysis</div>
      <h1>Draft Lab</h1>
      <p className="dek">
        Every skill-position pick (QB/RB/WR/TE) judged against its draft slot — separately by position, since a
        mediocre QB still outscores most TEs in raw points. "Drafted" and "Finished" are both ranks within that
        position and year only (e.g. the 5th QB taken vs. the 2nd-best-scoring QB that year). Kickers and defenses
        are excluded entirely — their draft slots are arbitrary enough that "value" isn't a meaningful story.
      </p>

      {SKILL_POSITIONS.map((pos) => (
        <PositionValueCard key={pos} pos={pos} />
      ))}

      <div className="card">
        <h2>Repeat Draftees</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Managers who kept drafting the same player in different years.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Manager</th>
                <th>Player</th>
                <th className="num">Times Drafted</th>
                <th>Years</th>
              </tr>
            </thead>
            <tbody>
              {repeatDraftees.map((r) => (
                <tr key={`${r.userId}-${r.playerId}`}>
                  <td>
                    <Link to={`/team/${r.userId}`}>{r.managerName}</Link>
                  </td>
                  <td>{r.playerName}</td>
                  <td className="num">{r.years.length}</td>
                  <td>{r.years.join(", ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Draft Tendencies</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          Average round each manager has spent their picks on a position, across every draft they've been in. Lower
          means they draft that position earlier. Click a column to sort.
        </p>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th className="sortable" onClick={() => onSort("managerName")}>
                  Manager{sortKey === "managerName" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                </th>
                {TENDENCY_POS_ORDER.map((pos) => (
                  <th key={pos} className="sortable num" onClick={() => onSort(pos)}>
                    {pos}
                    {sortKey === pos ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedTendencies.map((t) => (
                <tr key={t.userId}>
                  <td>
                    <Link to={`/team/${t.userId}`}>{t.managerName}</Link>
                  </td>
                  {TENDENCY_POS_ORDER.map((pos) => (
                    <td key={pos} className="num">
                      {t.avgRoundByPos[pos] !== undefined ? t.avgRoundByPos[pos].toFixed(1) : "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
