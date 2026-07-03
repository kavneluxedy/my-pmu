import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, type BankrollStats, type Bet } from "../api/client.js";

export default function Dashboard() {
  const [stats, setStats] = useState<BankrollStats | null>(null);
  const [bets, setBets] = useState<Bet[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.bankroll(), api.listBets()])
      .then(([s, b]) => {
        setStats(s);
        setBets(b.slice(0, 5));
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return <p className="error">{error}</p>;
  if (!stats) return <p className="muted">Chargement…</p>;

  const money = (n: number) => `${n.toFixed(2)} €`;

  return (
    <div>
      <h2>Tableau de bord</h2>
      <div className="cards">
        <div className="card">
          <div className="label">Profit net</div>
          <div className={`value ${stats.netProfit >= 0 ? "pos" : "neg"}`}>{money(stats.netProfit)}</div>
        </div>
        <div className="card">
          <div className="label">ROI</div>
          <div className={`value ${stats.roi >= 0 ? "pos" : "neg"}`}>{stats.roi.toFixed(1)} %</div>
        </div>
        <div className="card">
          <div className="label">Total misé</div>
          <div className="value">{money(stats.totalStaked)}</div>
        </div>
        <div className="card">
          <div className="label">Taux de réussite</div>
          <div className="value">{stats.hitRate.toFixed(0)} %</div>
        </div>
      </div>

      <div className="panel">
        <h3>Évolution de la bankroll</h3>
        {stats.balanceCurve.length === 0 ? (
          <p className="muted">Aucun pari réglé pour l'instant.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={stats.balanceCurve} margin={{ top: 10, right: 20, bottom: 0, left: -10 }}>
              <CartesianGrid stroke="#2c3547" strokeDasharray="3 3" />
              <XAxis dataKey="date" stroke="#90a0b7" fontSize={12} />
              <YAxis stroke="#90a0b7" fontSize={12} />
              <Tooltip contentStyle={{ background: "#1a2130", border: "1px solid #2c3547" }} />
              <Line type="monotone" dataKey="balance" stroke="#35c46a" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="panel">
        <h3>Derniers paris</h3>
        <table>
          <thead>
            <tr><th>Date</th><th>Type</th><th>Libellé</th><th>Mise</th><th>Statut</th><th>Gain</th></tr>
          </thead>
          <tbody>
            {bets.map((b) => (
              <tr key={b.id}>
                <td>{b.date}</td>
                <td>{b.betType}</td>
                <td>{b.label ?? "—"}</td>
                <td>{money(b.stake)}</td>
                <td><span className={`badge ${b.status}`}>{b.status}</span></td>
                <td>{b.payout != null ? money(b.payout) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
