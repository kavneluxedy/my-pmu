import { useState } from "react";
import { refreshRace } from "../raceStore.js";

export default function RefreshOddsButton() {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      await refreshRace();
    } catch {
      // Silencieux : le polling réessaiera de toute façon.
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="secondary" onClick={run} disabled={busy} style={{ whiteSpace: "nowrap" }}>
      {busy ? "Actualisation…" : "↻ Actualiser les cotes"}
    </button>
  );
}