export interface StatTileData {
  label: string;
  value: string;
  accent?: boolean;
}

export default function StatTiles({ stats }: { stats: StatTileData[] }) {
  return (
    <div className="stat-tiles">
      {stats.map((s) => (
        <div className="stat-tile" key={s.label}>
          <div className={`st-value${s.accent ? " accent" : ""}`}>{s.value}</div>
          <div className="st-label">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
