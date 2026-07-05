type CountdownTone = "green" | "orange" | "red" | "past" | "imminent";

interface CountdownStatus {
  /** Heure de départ absolue, formatée HH:mm. */
  time: string;
  /** Compte à rebours relatif : "mm:ss", "-mm:ss" ou "Partie". */
  label: string;
  tone: CountdownTone;
  color: string;
}

const TONE_COLORS: Record<CountdownTone, string> = {
  green: "#1b8a3a",
  orange: "#c46a10",
  red: "#b3261e",
  imminent: "#b3261e",
  past: "#666",
};

function formatMmSs(ms: number): string {
  const total = Math.floor(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * Statut du minuteur relatif au départ d'une course.
 * Renvoie null si l'heure de départ est inconnue (aucune pastille à afficher).
 *
 * `departImminent` est le signal live du PMU : quand il est vrai, l'heure de
 * départ théorique peut être dépassée sans que la course soit réellement partie
 * (mise en place des partants). On affiche alors « Imminent » plutôt qu'un
 * compte à rebours faussement précis ou un « Partie » prématuré.
 */
function countdownStatus(
  startTime: number | undefined,
  now: number,
  departImminent?: boolean,
): CountdownStatus | null {
  if (typeof startTime !== "number") return null;
  const time = new Date(startTime).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const deltaMs = startTime - now;
  let tone: CountdownTone;
  let label: string;
  if (departImminent) {
    tone = "imminent";
    label = "Imminent";
  } else if (deltaMs <= 0) {
    tone = "past";
    label = "Partie";
  } else {
    label = formatMmSs(deltaMs);
    if (deltaMs <= 60_000) tone = "red";
    else if (deltaMs <= 180_000) tone = "orange";
    else tone = "green";
  }
  return { time, label, tone, color: TONE_COLORS[tone] };
}

/** Pastille compacte heure + compte à rebours (boutons de la liste). */
function CountdownPill({ status }: Readonly<{ status: CountdownStatus }>) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 3,
        marginLeft: 6,
        padding: "2px 8px",
        borderRadius: 10,
        fontSize: 10,
        fontWeight: 600,
        fontFamily: "monospace",
        background: status.color,
        color: "#fff",
        whiteSpace: "nowrap",
      }}
    >
      {status.time} · {status.label}
    </span>
  );
}

export { CountdownPill, countdownStatus };
export type { CountdownStatus };

