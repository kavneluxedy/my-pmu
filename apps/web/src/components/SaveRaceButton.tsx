import { useState } from "react";
import { api } from "../api/client.js";
import { getProgrammeStore } from "../programmeStore.js";
import { getStoredRace } from "../raceStore.js";
import { pushToast } from "../toastStore.js";

/**
 * Sauvegarde durablement la course chargée dans le Simulateur (snapshot figé en
 * DB : partants + cotes du moment). Contrairement au store sessionStorage
 * éphémère, la course reste consultable plus tard via « Mes courses »,
 * notamment après avoir parié dessus.
 *
 * `ProviderRace` ne porte ni `startTime` ni le nom d'hippodrome ; on les
 * récupère depuis le programme (même croisement reunion/course que ImportPmu)
 * pour enrichir l'étiquette et l'heure de départ.
 */
export default function SaveRaceButton() {
  const [busy, setBusy] = useState(false);

  const run = async () => {
    const stored = getStoredRace();
    if (!stored) return; // Aucune course chargée : rien à sauvegarder.
    const { date, race } = stored;

    // Enrichissement best-effort depuis le programme (hippodrome, nom, départ).
    const programme = getProgrammeStore();
    const meeting = programme?.meetings.find((m) => m.reunion === race.reunion);
    const progRace = meeting?.races.find((c) => c.course === race.course);
    const labelParts = [meeting?.hippodrome, progRace?.name ?? race.name].filter(Boolean);
    const label = labelParts.length > 0 ? labelParts.join(" — ") : undefined;
    const startTime = progRace?.startTime ?? race.startTime;

    setBusy(true);
    try {
      await api.createSavedRace({
        date,
        reunion: race.reunion,
        course: race.course,
        label,
        startTime,
        payload: JSON.stringify(race),
      });
      pushToast({
        tone: "success",
        message: "✓ Course sauvegardée",
        durationMs: 6000,
        actions: [{ label: "Voir mes courses →", to: "/mes-courses" }],
      });
    } catch (e) {
      pushToast({
        tone: "error",
        message: `La course n'a pas pu être sauvegardée : ${(e as Error).message}`,
        durationMs: 6000,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <button className="secondary" onClick={run} disabled={busy} style={{ whiteSpace: "nowrap" }}>
      {busy ? "Sauvegarde…" : "★ Sauvegarder"}
    </button>
  );
}
