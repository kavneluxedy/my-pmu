/** Petit client HTTP typé pour l'API @pmu/api (via le proxy Vite /api). */

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `Erreur ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export interface Horse {
  id: number;
  name: string;
  sex?: string | null;
  age?: number | null;
  discipline?: string | null;
  usualDriver?: string | null;
  favHippodrome?: string | null;
  notes?: string | null;
  isFavorite: boolean;
}

export interface Bet {
  id: number;
  date: string;
  betType: string;
  label?: string | null;
  stake: number;
  odds?: number | null;
  status: "pending" | "won" | "lost";
  payout?: number | null;
}

export interface BankrollStats {
  totalStaked: number;
  totalReturned: number;
  netProfit: number;
  roi: number;
  settledBets: number;
  wonBets: number;
  hitRate: number;
  balanceCurve: { date: string; balance: number }[];
}

export interface TicketCost {
  betType: string;
  combinations: number;
  unitStake: number;
  totalCost: number;
}

export interface DutchingResult {
  legs: { selection: number | string; odds: number; stake: number; grossReturn: number }[];
  totalStake: number;
  guaranteedReturn: number;
  guaranteedProfit: number;
  impliedProbabilitySum: number;
  isArbitrage: boolean;
}

export interface ValueBetResult {
  odds: number;
  impliedProbability: number;
  estimatedProbability: number;
  expectedValue: number;
  edge: number;
  isValueBet: boolean;
  kellyStake: number;
}

/** Résultat d'une prévision de gain (miroir de `PayoutResult` de @pmu/engine). */
export interface PayoutResult {
  betType: string;
  mode: "cote" | "masses";
  rapportNetPourUnEuro: number;
  rapportBrutPourUnEuro: number;
  stake: number;
  grossPayout: number;
  netProfit: number;
  returnOnStake: number;
}

export interface ProviderRace {
  reunion: number;
  course: number;
  name?: string;
  /** Timestamp epoch (ms) du départ officiel de la course, si disponible. */
  startTime?: number;
  /** Départ imminent signalé par le PMU (partants sous les ordres). */
  departImminent?: boolean;
  runners: { number: number; name: string; odds?: number; jockey?: string; scratched?: boolean }[];
}

export interface ProviderProgramme {
  date: string;
  meetings: {
    reunion: number;
    hippodrome: string;
    races: { reunion: number; course: number; name?: string; discipline?: string; distance?: number; startTime?: number; departImminent?: boolean }[];
  }[];
}

/** Enjeu misé sur un cheval pour un type de pari (miroir de @pmu/engine). */
export interface CitationRunner {
  number: number;
  name: string;
  scratched?: boolean;
  favoris?: boolean;
  enjeu: number;
  ratio?: number;
}

/** Bloc « citations » d'un type de pari sur une course. */
export interface CitationBetType {
  betType?: string;
  rawTypePari: string;
  indisponible?: boolean;
  totalPool: number;
  runners: CitationRunner[];
}

/** Réponse « citations » normalisée d'une course (enjeux / rapports probables). */
export interface ProviderCitations {
  reunion: number;
  course: number;
  updatetime?: number;
  betTypes: CitationBetType[];
}

export interface ArrivalRunner {
  position: number;
  number: number;
  name?: string;
  deadHeat?: boolean;
}

export interface Arrival {
  reunion: number;
  course: number;
  ordre: ArrivalRunner[];
  definitif: boolean;
  updatetime?: number;
}

export const api = {
  // Chevaux
  listHorses: () => request<Horse[]>("/api/horses"),
  createHorse: (data: Partial<Horse>) =>
    request<Horse>("/api/horses", { method: "POST", body: JSON.stringify(data) }),
  deleteHorse: (id: number) => request<void>(`/api/horses/${id}`, { method: "DELETE" }),

  // Paris
  listBets: () => request<Bet[]>("/api/bets"),
  createBet: (data: Partial<Bet>) =>
    request<Bet>("/api/bets", { method: "POST", body: JSON.stringify(data) }),
  updateBet: (id: number, data: Partial<Bet>) =>
    request<Bet>(`/api/bets/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteBet: (id: number) => request<void>(`/api/bets/${id}`, { method: "DELETE" }),

  // Stats
  bankroll: () => request<BankrollStats>("/api/stats/bankroll"),

  // Simulations
  simTicket: (body: unknown) =>
    request<TicketCost>("/api/sim/ticket", { method: "POST", body: JSON.stringify(body) }),
  simDutching: (body: unknown) =>
    request<DutchingResult>("/api/sim/dutching", { method: "POST", body: JSON.stringify(body) }),
  simValueBet: (body: unknown) =>
    request<ValueBetResult>("/api/sim/valuebet", { method: "POST", body: JSON.stringify(body) }),
  simPayout: (body: unknown) =>
    request<PayoutResult>("/api/sim/payout", { method: "POST", body: JSON.stringify(body) }),

  // Import PMU
  programme: (date: string) =>
    request<ProviderProgramme>(`/api/pmu/programme?date=${date}`),
  course: (date: string, reunion: number, course: number) =>
    request<ProviderRace>(`/api/pmu/course/${date}/${reunion}/${course}`),
  citations: (date: string, reunion: number, course: number) =>
    request<ProviderCitations>(`/api/pmu/citations/${date}/${reunion}/${course}`),
  arrivee: (date: string, reunion: number, course: number) =>
    request<Arrival>(`/api/pmu/arrivee/${date}/${reunion}/${course}`),
  setRunnerFavorite: (
    date: string,
    reunion: number,
    course: number,
    number: number,
    isFavorite: boolean,
  ) =>
    request<{ success: boolean }>("/api/pmu/runner-favorite", {
      method: "POST",
      body: JSON.stringify({ date, reunion, course, number, isFavorite }),
    }),
};
