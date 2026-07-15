import { useState } from "react";
import { useQuickAddBet, type QuickBetDraft } from "../hooks/useQuickAddBet.js";
import { roundStakeToEuro } from "../lib/stake.js";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

interface Props {
  getDraft: (date: string, stake: number) => QuickBetDraft;
  defaultStake: number;
  minStake: number;
  label: string;
  disabled?: boolean;
  disabledReason?: string;
}

export default function AddToBetsButton({ getDraft, defaultStake, minStake, label, disabled, disabledReason }: Readonly<Props>) {
  const { addBets, busy } = useQuickAddBet();
  const [date, setDate] = useState(today);
  const [stake, setStake] = useState(() => roundStakeToEuro(defaultStake, minStake));
  const [showDate, setShowDate] = useState(false);
  const [showStake, setShowStake] = useState(false);
  const [justAdded, setJustAdded] = useState(false);

  const handleClick = async () => {
    await addBets([getDraft(date, stake)]);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 350);
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
      <button
        className={`cta-add-bet${justAdded ? " just-added" : ""}`}
        onClick={handleClick}
        disabled={disabled || busy}
        title={disabled ? disabledReason : undefined}
      >
        {label}
      </button>
      <button type="button" className="secondary" onClick={() => setShowDate((s) => !s)} title="Changer la date">📅</button>
      <button type="button" className="secondary" onClick={() => setShowStake((s) => !s)} title="Ajuster la mise">✎</button>
      {showDate && (
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: 140 }} />
      )}
      {showStake && (
        <input
          type="number"
          step="1"
          min={minStake}
          value={stake}
          onChange={(e) => setStake(Number(e.target.value))}
          style={{ width: 80 }}
        />
      )}
    </div>
  );
}
