import { NavLink } from "react-router-dom";

const links = [
  { to: "/", label: "League History", end: true },
  { to: "/seasons", label: "Seasons" },
  { to: "/standings", label: "All-Time Standings" },
  { to: "/draft-lab", label: "Draft Lab" },
  { to: "/stats", label: "Stats" },
  { to: "/h2h", label: "Head-to-Head" },
];

export default function Nav() {
  return (
    <header
      style={{
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        position: "sticky",
        top: 0,
        zIndex: 10,
      }}
    >
      <nav
        style={{
          maxWidth: 1080,
          margin: "0 auto",
          padding: "14px 20px",
          display: "flex",
          alignItems: "center",
          gap: 24,
        }}
      >
        <span
          style={{
            fontFamily: "var(--font-serif)",
            fontStyle: "italic",
            fontWeight: 600,
            fontSize: "1.05rem",
            color: "var(--ink)",
          }}
        >
          TBS Fantasy League
        </span>
        <div style={{ display: "flex", gap: 16 }}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              style={({ isActive }) => ({
                color: isActive ? "var(--accent)" : "var(--ink-muted)",
                fontWeight: isActive ? 600 : 500,
                textDecoration: "none",
              })}
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </header>
  );
}
