import { useEffect, useState } from "react";
import { api, type Bet } from "../api/client.js";
import { BET_TYPE_LABELS, BET_TYPES } from "../lib/betTypes.js";
import { useSortable } from "../hooks/useSortable.js";

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  betType: "simple_gagnant",
  label: "",
  stake: "5",
};

export default function Bets() {
  const [bets, setBets] = useState<Bet[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState<string | null>(null);
  const { sorted: sortedBets, sort, toggleSort } = useSortable(bets);

  const reload = () => api.listBets().then(setBets).catch((e) => setError(String(e)));
  useEffect(() => {
    void reload();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createBet({
        date: form.date,
        betType: form.betType,
        label: form.label || undefined,
        stake: Number(form.stake),
      });
      setForm({ ...emptyForm });
      void reload();
    } catch (e) {
      setError(String(e));
    }
  };

  const settle = async (bet: Bet, status: "won" | "lost") => {
    const payout =
      status === "won" ? Number(prompt("Gain brut encaissé (€) ?", "0") ?? "0") : 0;
    await api.updateBet(bet.id, { status, payout });
    void reload();
  };

  const remove = async (id: number) => {
    await api.deleteBet(id);
    void reload();
  };

  const money = (n: number) => `${n.toFixed(2)} €`;

  return (
    <div>
      <h2>Mes paris</h2>

      <div className="panel">
        <h3>Enregistrer un pari</h3>
        <form className="form-grid" onSubmit={submit}>
          <div className="field">
            <label>Date</label>
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div className="field">
            <label>Type</label>
            <select value={form.betType} onChange={(e) => setForm({ ...form, betType: e.target.value })}>
              {BET_TYPES.map((t) => <option key={t} value={t}>{BET_TYPE_LABELS[t]}</option>)}
            </select>
          </div>
          <div className="field" style={{ gridColumn: "span 2" }}>
            <label>Libellé (course, chevaux…)</label>
            <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} placeholder="R1C3 - n°7" />
          </div>
          <div className="field">
            <label>Mise (€)</label>
            <input type="number" step="0.5" min="0.5" value={form.stake} onChange={(e) => setForm({ ...form, stake: e.target.value })} />
          </div>
          <div className="field">
            <label>&nbsp;</label>
            <button type="submit">Ajouter</button>
          </div>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th onClick={() => toggleSort('date')} style={{ cursor: 'pointer' }}>Date {sort.key === 'date' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => toggleSort('betType')} style={{ cursor: 'pointer' }}>Type {sort.key === 'betType' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => toggleSort('label')} style={{ cursor: 'pointer' }}>Libellé {sort.key === 'label' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => toggleSort('stake')} style={{ cursor: 'pointer' }}>Mise {sort.key === 'stake' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => toggleSort('status')} style={{ cursor: 'pointer' }}>Statut {sort.key === 'status' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
              <th onClick={() => toggleSort('payout')} style={{ cursor: 'pointer' }}>Gain {sort.key === 'payout' && (sort.direction === 'asc' ? '▲' : '▼')}</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {sortedBets.map((b) => (
              <tr key={b.id}>
                <td>{b.date}</td>
                <td>{b.betType}</td>
                <td>{b.label ?? "—"}</td>
                <td>{money(b.stake)}</td>
                <td><span className={`badge ${b.status}`}>{b.status}</span></td>
                <td>{b.payout != null ? money(b.payout) : "—"}</td>
                <td style={{ display: "flex", gap: 6 }}>
                  {b.status === "pending" && (
                    <>
                      <button className="secondary" onClick={() => settle(b, "won")}>Gagné</button>
                      <button className="secondary" onClick={() => settle(b, "lost")}>Perdu</button>
                    </>
                  )}
                  <button className="danger" onClick={() => remove(b.id)}>×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
