import { useCallback, useState } from "react";
import { api, type Bet } from "../api/client.js";
import { pushToast } from "../toastStore.js";

export interface QuickBetDraft {
  date: string;
  betType: string;
  label?: string;
  stake: number;
  odds?: number;
}

function isFulfilled<T>(r: PromiseSettledResult<T>): r is PromiseFulfilledResult<T> {
  return r.status === "fulfilled";
}

export function useQuickAddBet() {
  const [busy, setBusy] = useState(false);

  const addBets = useCallback(async (drafts: QuickBetDraft[]): Promise<Bet[]> => {
    if (drafts.length === 0) return [];
    setBusy(true);
    const settled = await Promise.allSettled(drafts.map((d) => api.createBet(d)));
    setBusy(false);

    const created = settled.filter(isFulfilled).map((r) => r.value);
    const failedCount = settled.length - created.length;

    if (created.length > 0) {
      pushToast({
        tone: "success",
        message: created.length === 1 ? "✓ Pari ajouté" : `✓ ${created.length} paris ajoutés`,
        durationMs: 6000,
        actions: [
          {
            label: "Annuler",
            onClick: () => {
              void Promise.allSettled(created.map((b) => api.deleteBet(b.id)));
            },
          },
          { label: "Voir mes paris →", to: "/bets" },
        ],
      });
    }
    if (failedCount > 0) {
      pushToast({
        tone: "error",
        message: `${failedCount} pari${failedCount > 1 ? "s n'ont" : " n'a"} pas pu être ajouté${failedCount > 1 ? "s" : ""}`,
        durationMs: 6000,
      });
    }

    return created;
  }, []);

  return { addBets, busy };
}
