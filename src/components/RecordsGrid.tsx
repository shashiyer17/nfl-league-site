import type { RecordHighlight } from "../lib/derive";

export default function RecordsGrid({ records }: { records: RecordHighlight[] }) {
  return (
    <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
      {records.map((r) => (
        <div className="pullquote" key={r.label} style={{ minWidth: 200 }}>
          <div className="pq-label">{r.label}</div>
          <div className="pq-value">{r.value}</div>
          <div className="pq-detail">{r.detail}</div>
        </div>
      ))}
    </div>
  );
}
