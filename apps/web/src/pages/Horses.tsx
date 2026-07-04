import { useEffect, useState } from "react";
import { api, type Horse } from "../api/client.js";
import { useSortable } from "../hooks/useSortable.js";

const emptyForm = {
  name: "",
  sex: "",
  age: "",
  discipline: "attele",
  usualDriver: "",
  favHippodrome: "",
  notes: "",
};

export default function Horses() {
  const [horses, setHorses] = useState<Horse[]>([]);
  const [form, setForm] = useState({ ...emptyForm });
  const [error, setError] = useState<string | null>(null);
  const { sorted: sortedHorses, sort, toggleSort } = useSortable(horses);

  const reload = () => api.listHorses().then(setHorses).catch((e) => setError(String(e)));
  useEffect(() => {
    void reload();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await api.createHorse({
        name: form.name,
        sex: form.sex || undefined,
        age: form.age ? Number(form.age) : undefined,
        discipline: form.discipline || undefined,
        usualDriver: form.usualDriver || undefined,
        favHippodrome: form.favHippodrome || undefined,
        notes: form.notes || undefined,
      });
      setForm({ ...emptyForm });
      void reload();
    } catch (e) {
      setError(String(e));
    }
  };

  return (
    <div>
      <h2>Mes chevaux favoris</h2>

      <div className="panel">
        <h3>Ajouter un cheval</h3>
        <form className="form-grid" onSubmit={submit}>
          <div className="field"><label>Nom</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Sexe</label><input value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })} placeholder="M / F / H" /></div>
          <div className="field"><label>Âge</label><input type="number" value={form.age} onChange={(e) => setForm({ ...form, age: e.target.value })} /></div>
          <div className="field">
            <label>Discipline</label>
            <select value={form.discipline} onChange={(e) => setForm({ ...form, discipline: e.target.value })}>
              {["attele", "monte", "plat", "obstacle", "trot"].map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div className="field"><label>Driver / jockey</label><input value={form.usualDriver} onChange={(e) => setForm({ ...form, usualDriver: e.target.value })} /></div>
          <div className="field"><label>Hippodrome fav.</label><input value={form.favHippodrome} onChange={(e) => setForm({ ...form, favHippodrome: e.target.value })} /></div>
          <div className="field" style={{ gridColumn: "span 2" }}><label>Notes</label><input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          <div className="field"><label>&nbsp;</label><button type="submit">Ajouter</button></div>
        </form>
        {error && <p className="error">{error}</p>}
      </div>

      <div className="panel" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="muted" style={{ fontSize: 13 }}>Trier par :</span>
          <button className={sort.key === 'name' ? undefined : 'secondary'} onClick={() => toggleSort('name')} style={sort.key === 'name' ? { background: '#35c46a', color: '#0b1a10' } : {}}>Nom {sort.key === 'name' && (sort.direction === 'asc' ? '▲' : '▼')}</button>
          <button className={sort.key === 'discipline' ? undefined : 'secondary'} onClick={() => toggleSort('discipline')} style={sort.key === 'discipline' ? { background: '#35c46a', color: '#0b1a10' } : {}}>Discipline {sort.key === 'discipline' && (sort.direction === 'asc' ? '▲' : '▼')}</button>
          <button className={sort.key === 'age' ? undefined : 'secondary'} onClick={() => toggleSort('age')} style={sort.key === 'age' ? { background: '#35c46a', color: '#0b1a10' } : {}}>Âge {sort.key === 'age' && (sort.direction === 'asc' ? '▲' : '▼')}</button>
        </div>
      </div>

      <div className="cards">
        {sortedHorses.map((h) => (
          <div className="card" key={h.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
              <div className="value" style={{ fontSize: 18 }}>{h.name}</div>
              <button className="danger" onClick={() => api.deleteHorse(h.id).then(reload)}>×</button>
            </div>
            <div className="muted" style={{ fontSize: 13, marginTop: 8, lineHeight: 1.6 }}>
              {h.discipline && <div>Discipline : {h.discipline}</div>}
              {(h.sex || h.age) && <div>{h.sex ?? ""} {h.age ? `${h.age} ans` : ""}</div>}
              {h.usualDriver && <div>Driver : {h.usualDriver}</div>}
              {h.favHippodrome && <div>Hippodrome : {h.favHippodrome}</div>}
              {h.notes && <div style={{ marginTop: 6 }}>{h.notes}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
