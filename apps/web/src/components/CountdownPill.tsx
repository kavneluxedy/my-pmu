import { type CountdownStatus } from "../lib/time.js";

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

export { CountdownPill };

