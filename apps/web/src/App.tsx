import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useProgrammePolling, useProgrammeStore } from "./programmeStore.js";

const links = [
  { to: "/", label: "Tableau de bord", icon: "⊞", end: true },
  { to: "/bets", label: "Mes paris", icon: "🎫", end: false },
  { to: "/horses", label: "Mes chevaux", icon: "🐎", end: false },
  { to: "/simulator", label: "Simulateur", icon: "⚡", end: false },
  { to: "/import", label: "Import PMU", icon: "↓", end: false },
  { to: "/arrivees", label: "Arrivées", icon: "🏁", end: false },
];

type Tone = "green" | "orange" | "red";

const TONE_COLORS: Record<Tone, string> = {
  green: "#1b8a3a",
  orange: "#c46a10",
  red: "#b3261e",
};

function formatMmSs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function NextRaceWidget({ collapsed = false, topbar = false }: Readonly<{ collapsed?: boolean; topbar?: boolean }>) {
  const navigate = useNavigate();
  const programme = useProgrammeStore();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!programme) return null;

  // Une course « à départ imminent » (drapeau live PMU) prime, même si son
  // startTime théorique est déjà dépassé : le PMU n'a pas encore donné le
  // départ. Sinon, la prochaine course à venir (startTime > now, minimum).
  let nextReunion = 0;
  let nextCourse = 0;
  let nextHippo = "";
  let nextTs = Infinity;
  let nextImminent = false;
  for (const m of programme.meetings) {
    for (const c of m.races) {
      if (c.startTime == null) continue;
      const eligible = c.departImminent === true || c.startTime > now;
      if (!eligible) continue;
      // Priorité aux départs imminents ; à défaut, au startTime le plus proche.
      const better = c.departImminent === true
        ? !nextImminent || c.startTime < nextTs
        : !nextImminent && c.startTime < nextTs;
      if (better) {
        nextTs = c.startTime;
        nextReunion = m.reunion;
        nextCourse = c.course;
        nextHippo = m.hippodrome;
        nextImminent = c.departImminent === true;
      }
    }
  }

  if (!nextReunion) return null;

  const deltaMs = nextTs - now;
  // Départ imminent : ne pas afficher un compte à rebours faussement précis
  // (ni un temps négatif). Le PMU garde la course « en cours de départ ».
  const imminent = nextImminent || deltaMs <= 0;
  const label = imminent ? "Départ imminent" : formatMmSs(deltaMs);
  const shortLabel = imminent ? "DÉPART" : formatMmSs(deltaMs);
  const tone: Tone =
    nextImminent || deltaMs <= 60_000 ? "red" : deltaMs <= 180_000 ? "orange" : "green";
  const color = TONE_COLORS[tone];
  const time = new Date(nextTs).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  if (topbar) {
    return (
      <div
        className="next-race-topbar"
        onClick={() => navigate(`/import?reunion=${nextReunion}&course=${nextCourse}`)}
        style={{ borderColor: color, background: `${color}18` }}
      >
        <span style={{ fontSize: 13 }}>⏱</span>
        <span className="nrt-rc">R{nextReunion} C{nextCourse}</span>
        <span className="nrt-hippo">{nextHippo}</span>
        <span className="nrt-time">{time}</span>
        <span className="nrt-badge" style={{ background: color }}>{label}</span>
      </div>
    );
  }

  if (collapsed) {
    return (
      <div
        className="next-race-collapsed"
        onClick={() => navigate(`/import?reunion=${nextReunion}&course=${nextCourse}`)}
        title={`R${nextReunion} C${nextCourse} — ${time} · ${label}`}
        style={{ borderColor: color, background: `${color}22` }}
      >
        <span style={{ fontSize: 14 }}>⏱</span>
        <span style={{
          fontFamily: "monospace",
          fontSize: 9,
          fontWeight: 700,
          color,
          lineHeight: 1.2,
          textAlign: "center",
        }}>
          {shortLabel}
        </span>
      </div>
    );
  }

  return (
    <div
      className="next-race-widget"
      onClick={() => navigate(`/import?reunion=${nextReunion}&course=${nextCourse}`)}
      style={{ borderColor: color, background: `${color}18` }}
    >
      <div style={{ color, fontWeight: 700, fontSize: 10, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
        ⏱ Prochaine course
      </div>
      <div style={{ fontWeight: 700, fontSize: 13 }}>R{nextReunion} C{nextCourse}</div>
      <div style={{ color: "var(--muted)", fontSize: 11, marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {nextHippo}
      </div>
      <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontFamily: "monospace", fontSize: 13, color: "var(--text)" }}>{time}</span>
        <span style={{
          fontFamily: "monospace",
          fontSize: 11,
          fontWeight: 700,
          padding: "2px 7px",
          borderRadius: 8,
          background: color,
          color: "#fff",
          whiteSpace: "nowrap",
        }}>
          {label}
        </span>
      </div>
    </div>
  );
}

export default function App() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  const backdropRef = useRef<HTMLDivElement>(null);
  useProgrammePolling();

  // Détecter le changement de breakpoint
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // Fermer le menu mobile si on passe à desktop
      if (!mobile) setMobileMenuOpen(false);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Fermer le menu en cliquant sur le backdrop
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === backdropRef.current) {
      setMobileMenuOpen(false);
    }
  };

  // Fermer le menu après navigation
  const handleNavClick = () => {
    if (isMobile) {
      setMobileMenuOpen(false);
    }
  };

  return (
    <div className={`layout${collapsed ? " sidebar-collapsed" : ""}${mobileMenuOpen ? " mobile-menu-open" : ""}`}>
      {/* Backdrop mobile */}
      {isMobile && mobileMenuOpen && (
        <div
          className="mobile-backdrop"
          ref={backdropRef}
          onClick={handleBackdropClick}
          aria-hidden="true"
        />
      )}

      {/* Barre supérieure mobile : hamburger + bannière prochaine course */}
      {isMobile && (
        <div className="mobile-topbar">
          <button
            className="hamburger-menu"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Ouvrir le menu de navigation"
            aria-expanded={mobileMenuOpen}
            aria-controls="sidebar-nav"
          >
            <span />
            <span />
            <span />
          </button>
          <NextRaceWidget topbar />
        </div>
      )}

      <nav className="sidebar" id="sidebar-nav">
        {/* Zone scrollable : logo + liens */}
        <div className="sidebar-scroll">
          {!collapsed && (
            <>
              <h1 style={{ fontSize: 18, margin: "0 8px 4px" }}>🐎 PMU Suite</h1>
              <div className="brand-sub">Suivi &amp; optimisation</div>
            </>
          )}
          {collapsed && <div style={{ height: 12 }} />}

          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => `nav-link${isActive ? " active" : ""}${collapsed ? " nav-link-icon" : ""}`}
              title={collapsed ? l.label : undefined}
              onClick={handleNavClick}
            >
              <span className="nav-icon">{l.icon}</span>
              {!collapsed && <span>{l.label}</span>}
            </NavLink>
          ))}
        </div>

        {/* Zone fixe en bas : widget + toggle */}
        <div className="sidebar-bottom">
          {!isMobile && <NextRaceWidget collapsed={collapsed} />}
          {!isMobile && (
            <button
              className="sidebar-toggle"
              onClick={() => setCollapsed((c) => !c)}
              title={collapsed ? "Ouvrir le menu" : "Réduire le menu"}
              aria-label={collapsed ? "Ouvrir le menu" : "Réduire le menu"}
              aria-expanded={!collapsed}
            >
              {collapsed ? "›" : "‹"}
            </button>
          )}
        </div>
      </nav>

      <main className="content">
        <Outlet />
      </main>
    </div>
  );
}
