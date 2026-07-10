import { describe, expect, it } from "vitest";
import {
  PmuTurfinfoProvider,
  extractOdds,
  mapDiscipline,
  mapTypePari,
  normalizeCitationRunner,
  normalizeArrival,
  normalizeRunner,
  toPmuDate,
  mergeSimpleMassesFromCombinations,
} from "./pmuTurfinfo.js";

describe("toPmuDate", () => {
  it("convertit ISO → JJMMAAAA", () => {
    expect(toPmuDate("2026-07-03")).toBe("03072026");
  });
  it("rejette une date mal formée", () => {
    expect(() => toPmuDate("03/07/2026")).toThrow();
  });
});

describe("mapDiscipline", () => {
  it("mappe les spécialités PMU", () => {
    expect(mapDiscipline("TROT_ATTELE")).toBe("attele");
    expect(mapDiscipline("TROT_MONTE")).toBe("monte");
    expect(mapDiscipline("PLAT")).toBe("plat");
    expect(mapDiscipline("HAIE")).toBe("obstacle");
    expect(mapDiscipline(undefined)).toBeUndefined();
  });
});

describe("extractOdds", () => {
  it("prend le rapport direct en priorité", () => {
    expect(extractOdds({ dernierRapportDirect: { rapport: 4.5 } })).toBe(4.5);
  });
  it("retombe sur le rapport de référence", () => {
    expect(extractOdds({ dernierRapportReference: { rapport: 7 } })).toBe(7);
  });
  it("renvoie undefined sans cote", () => {
    expect(extractOdds({})).toBeUndefined();
  });
});

describe("normalizeRunner", () => {
  it("normalise un participant PMU brut", () => {
    const runner = normalizeRunner({
      numPmu: 3,
      nom: "GALOPIN DU BOIS",
      driver: "J. DUPONT",
      dernierRapportDirect: { rapport: 5.2 },
      statut: "PARTANT",
    });
    expect(runner).toMatchObject({
      number: 3,
      name: "GALOPIN DU BOIS",
      jockey: "J. DUPONT",
      odds: 5.2,
      scratched: false,
    });
  });
});

describe("normalizeArrival", () => {
  it("normalise un ordre d'arrivée simple", () => {
    const arrival = normalizeArrival({ ordreArrivee: [[3], [7], [1]] });
    expect(arrival.ordre).toEqual([
      { position: 1, number: 3, deadHeat: false },
      { position: 2, number: 7, deadHeat: false },
      { position: 3, number: 1, deadHeat: false },
    ]);
    expect(arrival.definitif).toBe(true);
  });

  it("détecte un dead-heat (ex-æquo)", () => {
    const arrival = normalizeArrival({ ordreArrivee: [[3, 5], [7]] });
    expect(arrival.ordre).toEqual([
      { position: 1, number: 3, deadHeat: true },
      { position: 1, number: 5, deadHeat: true },
      { position: 2, number: 7, deadHeat: false },
    ]);
    expect(arrival.definitif).toBe(true);
  });

  it("retourne un ordre vide si aucune arrivée", () => {
    const arrival = normalizeArrival({ ordreArrivee: [] });
    expect(arrival.ordre).toEqual([]);
    expect(arrival.definitif).toBe(false);
  });

  it("gère les numéros encapsulés dans des objets", () => {
    const arrival = normalizeArrival({
      ordreArrivee: [
        [{ numPmu: 3 }],
        [{ numero: 7 }],
      ],
    });
    expect(arrival.ordre).toEqual([
      { position: 1, number: 3, deadHeat: false },
      { position: 2, number: 7, deadHeat: false },
    ]);
  });

  it("ignore les numéros invalides (0 ou négatifs)", () => {
    const arrival = normalizeArrival({ ordreArrivee: [[3], [0], [1]] });
    expect(arrival.ordre).toEqual([
      { position: 1, number: 3, deadHeat: false },
      { position: 3, number: 1, deadHeat: false },
    ]);
  });
});

describe("normalizeArrival — format tableau rapports PMU", () => {
  it("extrait l'ordre depuis QUINTE_PLUS si disponible", () => {
    const arrival = normalizeArrival([
      { typePari: "SIMPLE_GAGNANT", rapports: [{ combinaison: "6" }] },
      { typePari: "TRIO", rapports: [{ combinaison: "6-2-4" }] },
      { typePari: "QUINTE_PLUS", rapports: [{ combinaison: "6-2-4-1-5" }] },
    ]);
    expect(arrival.ordre).toEqual([
      { position: 1, number: 6, deadHeat: false },
      { position: 2, number: 2, deadHeat: false },
      { position: 3, number: 4, deadHeat: false },
      { position: 4, number: 1, deadHeat: false },
      { position: 5, number: 5, deadHeat: false },
    ]);
    expect(arrival.definitif).toBe(true);
  });

  it("utilise SUPER_QUATRE (4 chevaux) en priorité sur TRIO", () => {
    const arrival = normalizeArrival([
      { typePari: "SIMPLE_GAGNANT", rapports: [{ combinaison: "3" }] },
      { typePari: "TRIO", rapports: [{ combinaison: "3-7-1" }] },
      { typePari: "SUPER_QUATRE", rapports: [{ combinaison: "3-7-1-8" }] },
    ]);
    expect(arrival.ordre).toEqual([
      { position: 1, number: 3, deadHeat: false },
      { position: 2, number: 7, deadHeat: false },
      { position: 3, number: 1, deadHeat: false },
      { position: 4, number: 8, deadHeat: false },
    ]);
    expect(arrival.definitif).toBe(true);
  });

  it("fallback sur TRIO si pas de SUPER_QUATRE", () => {
    const arrival = normalizeArrival([
      { typePari: "SIMPLE_GAGNANT", rapports: [{ combinaison: "3" }] },
      { typePari: "TRIO", rapports: [{ combinaison: "3-7-1" }] },
    ]);
    expect(arrival.ordre).toEqual([
      { position: 1, number: 3, deadHeat: false },
      { position: 2, number: 7, deadHeat: false },
      { position: 3, number: 1, deadHeat: false },
    ]);
    expect(arrival.definitif).toBe(true);
  });

  it("fallback sur SIMPLE_GAGNANT si seulement lui", () => {
    const arrival = normalizeArrival([
      { typePari: "SIMPLE_GAGNANT", rapports: [{ combinaison: "4" }] },
    ]);
    expect(arrival.ordre).toEqual([{ position: 1, number: 4, deadHeat: false }]);
    expect(arrival.definitif).toBe(true);
  });

  it("retourne vide si aucun rapport exploitable", () => {
    const arrival = normalizeArrival([{ typePari: "INCONNU", rapports: [] }]);
    expect(arrival.ordre).toEqual([]);
    expect(arrival.definitif).toBe(false);
  });
});

describe("PmuTurfinfoProvider", () => {
  it("parse le programme via un fetch injecté", async () => {
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        programme: {
          reunions: [
            {
              numOfficiel: 1,
              hippodrome: { libelleLong: "VINCENNES" },
              courses: [
                {
                  numOrdre: 1,
                  libelle: "Prix Test",
                  specialite: "TROT_ATTELE",
                  distance: 2700,
                  heureDepart: 1_767_441_600_000,
                },
              ],
            },
          ],
        },
      }),
    });
    const provider = new PmuTurfinfoProvider({ fetchImpl: fakeFetch });
    const prog = await provider.getProgramme("2026-07-03");
    expect(prog.meetings).toHaveLength(1);
    expect(prog.meetings[0]?.hippodrome).toBe("VINCENNES");
    expect(prog.meetings[0]?.races[0]?.discipline).toBe("attele");
    expect(prog.meetings[0]?.races[0]?.startTime).toBe(1_767_441_600_000);
  });

  it("mappe departImminent sans altérer startTime", async () => {
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        programme: {
          reunions: [
            {
              numOfficiel: 1,
              hippodrome: { libelleLong: "VINCENNES" },
              courses: [
                { numOrdre: 1, heureDepart: 1_767_441_600_000, departImminent: true },
                { numOrdre: 2, heureDepart: 1_767_441_900_000, departImminent: false },
                { numOrdre: 3, heureDepart: 1_767_442_200_000 },
              ],
            },
          ],
        },
      }),
    });
    const provider = new PmuTurfinfoProvider({ fetchImpl: fakeFetch });
    const prog = await provider.getProgramme("2026-07-03");
    const races = prog.meetings[0]?.races ?? [];
    expect(races[0]?.departImminent).toBe(true);
    expect(races[0]?.startTime).toBe(1_767_441_600_000); // startTime inchangé
    expect(races[1]?.departImminent).toBe(false);
    expect(races[2]?.departImminent).toBe(false); // absent → false
  });

  it("remonte une erreur si la requête échoue", async () => {
    const fakeFetch = async () => ({ ok: false, status: 503, json: async () => ({}) });
    const provider = new PmuTurfinfoProvider({ fetchImpl: fakeFetch });
    await expect(provider.getProgramme("2026-07-03")).rejects.toThrow();
  });
});

describe("mapTypePari", () => {
  it("mappe les types de pari exploitables", () => {
    expect(mapTypePari("E_SIMPLE_GAGNANT")).toBe("simple_gagnant");
    expect(mapTypePari("E_SIMPLE_PLACE")).toBe("simple_place");
    expect(mapTypePari("E_COUPLE_PLACE")).toBe("couple_place");
    expect(mapTypePari("E_TRIO")).toBe("trio");
  });
  it("ignore les types non pris en charge", () => {
    expect(mapTypePari("E_SUPER_QUATRE")).toBeUndefined();
    expect(mapTypePari("E_REPORT_PLUS")).toBeUndefined();
    expect(mapTypePari(undefined)).toBeUndefined();
  });
});

describe("normalizeCitationRunner", () => {
  it("retient l'enjeu de position 1 et remonte favoris/scratched", () => {
    const r = normalizeCitationRunner({
      numPmu: 3,
      nom: "JERZINHO SPORT",
      statut: "PARTANT",
      favoris: true,
      citations: [
        { position: 2, enjeu: 111, ratio: 5 },
        { position: 1, enjeu: 699800, ratio: 42.81 },
      ],
    });
    expect(r).toEqual({
      number: 3,
      name: "JERZINHO SPORT",
      scratched: false,
      favoris: true,
      enjeu: 6998,
      ratio: 42.81,
    });
  });
  it("marque les non-partants et renvoie null sans citation exploitable", () => {
    const np = normalizeCitationRunner({ numPmu: 5, nom: "ABSENT", statut: "NON_PARTANT", citations: [] });
    expect(np).toBeNull();
    const ok = normalizeCitationRunner({ numPmu: 6, nom: "OK", statut: "NON_PARTANT", citations: [{ position: 1, enjeu: 10 }] });
    expect(ok?.scratched).toBe(true);
  });
});

// Extrait réel réduit de la réponse « citations » (R6/C2 du 04/07/2026).
const CITATIONS_SAMPLE = {
  spritesCasaques: { small: {} },
  listeCitations: [
    {
      typePari: "E_SIMPLE_GAGNANT",
      updatetime: 1_783_185_190_000,
      participants: [
        { numPmu: 3, nom: "JERZINHO SPORT", statut: "PARTANT", favoris: true, citations: [{ position: 1, enjeu: 699800, ratio: 42.81 }] },
        { numPmu: 1, nom: "HARLEQUIN", statut: "PARTANT", favoris: false, citations: [{ position: 1, enjeu: 180530, ratio: 11.04 }] },
        { numPmu: 9, nom: "FORFAIT", statut: "NON_PARTANT", favoris: false, citations: [{ position: 1, enjeu: 5000, ratio: 0.3 }] },
      ],
    },
    {
      typePari: "E_SUPER_QUATRE",
      updatetime: 1_783_185_210_000,
      participants: [
        {
          numPmu: 1,
          nom: "HARLEQUIN",
          statut: "PARTANT",
          citations: [
            { position: 1, enjeu: 55750, ratio: 12.86 },
            { position: 2, enjeu: 82550, ratio: 19.04 },
          ],
        },
      ],
    },
    { typePari: "E_REPORT_PLUS", indisponible: true },
  ],
};

describe("getCitations", () => {
  const fakeFetch = async () => ({ ok: true, status: 200, json: async () => CITATIONS_SAMPLE });

  it("normalise les blocs et exclut les non-partants de la masse", async () => {
    const provider = new PmuTurfinfoProvider({ fetchImpl: fakeFetch });
    const cit = await provider.getCitations("2026-07-04", 6, 2);

    const sg = cit.betTypes.find((b) => b.rawTypePari === "E_SIMPLE_GAGNANT");
    expect(sg?.betType).toBe("simple_gagnant");
    // totalPool = 6998 + 1805.30 (le NON_PARTANT est exclu). En euros.
    expect(sg?.totalPool).toBe(8803.30);
    expect(sg?.runners).toHaveLength(3);
    expect(sg?.runners.find((r) => r.number === 9)?.scratched).toBe(true);
    expect(cit.updatetime).toBe(1_783_185_210_000);
  });

  it("conserve le libellé brut sans BetType pour un type non mappé", async () => {
    const provider = new PmuTurfinfoProvider({ fetchImpl: fakeFetch });
    const cit = await provider.getCitations("2026-07-04", 6, 2);
    const sq = cit.betTypes.find((b) => b.rawTypePari === "E_SUPER_QUATRE");
    expect(sq?.betType).toBeUndefined();
    // Seule la position 1 est retenue (557.50 euros), les positions > 1 ignorées.
    expect(sq?.runners[0]?.enjeu).toBe(557.50);
    expect(sq?.totalPool).toBe(557.50);
  });

  it("marque un bloc indisponible sans participants", async () => {
    const provider = new PmuTurfinfoProvider({ fetchImpl: fakeFetch });
    const cit = await provider.getCitations("2026-07-04", 6, 2);
    const rp = cit.betTypes.find((b) => b.rawTypePari === "E_REPORT_PLUS");
    expect(rp?.indisponible).toBe(true);
    expect(rp?.runners).toEqual([]);
    expect(rp?.totalPool).toBe(0);
  });

  it("remonte une erreur réseau", async () => {
    const provider = new PmuTurfinfoProvider({
      fetchImpl: async () => ({ ok: false, status: 502, json: async () => ({}) }),
    });
    await expect(provider.getCitations("2026-07-04", 6, 2)).rejects.toThrow();
  });
});

describe("getCoupleGagnantReports", () => {
  it("normalise les rapports Couplé Gagnant et déduplique par clé triée", async () => {
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        rapportsParticipant: [
          { numerosParticipant: [3, 7], rapportDirect: 45.5, tendance: -2.5 },
          { numerosParticipant: [7, 3], rapportDirect: 45.5, tendance: -2.5 }, // doublon inversé → dédupliqué
          { numerosParticipant: [1, 9], rapportDirect: 62.0, tendance: 5.0 },
        ],
      }),
    });
    const provider = new PmuTurfinfoProvider({ fetchImpl: fakeFetch });
    const reports = await provider.getCoupleGagnantReports("2026-07-04", 4, 7);

    expect(reports.reunion).toBe(4);
    expect(reports.course).toBe(7);
    expect(reports.reports).toHaveLength(2); // les 2 ordres regroupés en 1 paire
    expect(reports.reports[0]).toEqual({ pair: [3, 7], rapportDirect: 45.5, tendance: -2.5 });
    expect(reports.reports[1]).toEqual({ pair: [1, 9], rapportDirect: 62.0, tendance: 5.0 });
  });

  it("moyenne les 2 ordres d'une paire et renvoie une paire canonique triée", async () => {
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        rapportsParticipant: [
          { numerosParticipant: [6, 11], rapportDirect: 39, tendance: -2 },
          { numerosParticipant: [11, 6], rapportDirect: 41, tendance: 0 }, // ordre inversé, rapport différent
        ],
      }),
    });
    const provider = new PmuTurfinfoProvider({ fetchImpl: fakeFetch });
    const reports = await provider.getCoupleGagnantReports("2026-07-04", 4, 7);

    expect(reports.reports).toHaveLength(1);
    // Moyenne (39+41)/2 = 40 ; tendance (−2+0)/2 = −1 ; paire triée [6, 11].
    expect(reports.reports[0]).toEqual({ pair: [6, 11], rapportDirect: 40, tendance: -1 });
  });

  it("renvoie une liste vide si pas de rapports (204/erreur)", async () => {
    const provider = new PmuTurfinfoProvider({
      fetchImpl: async () => ({ ok: false, status: 204, json: async () => ({}) }),
    });
    const reports = await provider.getCoupleGagnantReports("2026-07-04", 4, 7);
    expect(reports.reports).toEqual([]);
  });

  it("ignore les entrées sans exactement 2 chevaux", async () => {
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        rapportsParticipant: [
          { numerosParticipant: [3], rapportDirect: 45.5 }, // 1 seul → ignoré
          { numerosParticipant: [1, 9, 5], rapportDirect: 62.0 }, // 3 → ignoré
          { numerosParticipant: [2, 6], rapportDirect: 35.0 }, // OK
        ],
      }),
    });
    const provider = new PmuTurfinfoProvider({ fetchImpl: fakeFetch });
    const reports = await provider.getCoupleGagnantReports("2026-07-04", 4, 7);
    expect(reports.reports).toHaveLength(1);
    expect(reports.reports[0]?.pair).toEqual([2, 6]);
  });
});

describe("getCombinations", () => {
  it("normalise les combinaisons avec leur pool", async () => {
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        combinaisons: [
          {
            pariType: "COUPLE_GAGNANT",
            updatetime: 1_783_185_290_000,
            totalEnjeu: 5000000,
            listeCombinaisons: [
              { combinaison: [3, 7], totalEnjeu: 250000 },
              { combinaison: [1, 9], totalEnjeu: 180000 },
            ],
          },
          {
            pariType: "COUPLE_PLACE",
            updatetime: 1_783_185_300_000, // Plus récent → sera le max
            totalEnjeu: 3500000,
            listeCombinaisons: [
              { combinaison: [3, 7], totalEnjeu: 140000 },
              { combinaison: [2, 6], totalEnjeu: 98000 },
            ],
          },
        ],
      }),
    });
    const provider = new PmuTurfinfoProvider({ fetchImpl: fakeFetch });
    const combos = await provider.getCombinations("2026-07-04", 4, 7);

    expect(combos.reunion).toBe(4);
    expect(combos.course).toBe(7);
    expect(combos.updatetime).toBe(1_783_185_300_000); // max des deux updatetimes
    expect(combos.betTypes).toHaveLength(2);

    const cg = combos.betTypes.find((b) => b.betType === "couple_gagnant");
    expect(cg?.rawTypePari).toBe("COUPLE_GAGNANT"); // conserve le libellé original (sans E_)
    expect(cg?.totalPool).toBe(50000);
    expect(cg?.combinations).toHaveLength(2);
    expect(cg?.combinations[0]).toEqual({ pair: [3, 7], enjeu: 2500 });

    const cp = combos.betTypes.find((b) => b.betType === "couple_place");
    expect(cp?.rawTypePari).toBe("COUPLE_PLACE");
    expect(cp?.totalPool).toBe(35000);
  });

  it("mappe COUPLE_PLACE (sans préfixe E_) vers couple_place", async () => {
    const fakeFetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        combinaisons: [
          {
            pariType: "COUPLE_PLACE", // sans E_ → mapTypePari tolère les deux
            totalEnjeu: 3500000,
            listeCombinaisons: [{ combinaison: [3, 7], totalEnjeu: 140000 }],
          },
        ],
      }),
    });
    const provider = new PmuTurfinfoProvider({ fetchImpl: fakeFetch });
    const combos = await provider.getCombinations("2026-07-04", 4, 7);
    const cp = combos.betTypes.find((b) => b.rawTypePari === "COUPLE_PLACE");
    expect(cp?.betType).toBe("couple_place"); // mappé correctement malgré l'absence de E_
  });

  it("renvoie une liste vide si pas de combinaisons (204/erreur)", async () => {
    const provider = new PmuTurfinfoProvider({
      fetchImpl: async () => ({ ok: false, status: 204, json: async () => ({}) }),
    });
    const combos = await provider.getCombinations("2026-07-04", 4, 7);
    expect(combos.betTypes).toEqual([]);
  });
});

describe("mergeSimpleMassesFromCombinations", () => {
  it("remplace pool et enjeux Simple par les valeurs tous canaux et recalcule le ratio", () => {
    const citations = {
      reunion: 6, course: 2,
      betTypes: [
        {
          betType: "simple_place", rawTypePari: "E_SIMPLE_PLACE", totalPool: 14739.60,
          runners: [
            { number: 3, name: "A", enjeu: 2184.70, ratio: 14.82, favoris: true },
            { number: 2, name: "B", enjeu: 1200.00, ratio: 8.14 },
          ],
        },
        // bloc non-Simple laissé intact :
        { betType: "couple_place", rawTypePari: "E_COUPLE_PLACE", totalPool: 100, runners: [{ number: 3, name: "A", enjeu: 50 }] },
      ],
    };
    const combinations = {
      reunion: 6, course: 2,
      betTypes: [
        {
          betType: "simple_place", rawTypePari: "SIMPLE_PLACE", totalPool: 70442.50,
          combinations: [
            { pair: [3], enjeu: 22139.00 },
            { pair: [2], enjeu: 16166.00 },
          ],
        },
      ],
    };
    const merged = mergeSimpleMassesFromCombinations(citations as any, combinations as any);
    const sp = merged.betTypes.find((b) => b.betType === "simple_place");
    expect(sp?.totalPool).toBe(70442.50);
    const r3 = sp?.runners.find((r) => r.number === 3);
    expect(r3?.enjeu).toBe(22139.00);
    expect(r3?.ratio).toBeCloseTo(31.43, 1);
    // le favori et le nom sont conservés
    expect(r3?.favoris).toBe(true);
    expect(r3?.name).toBe("A");
    // bloc non-Simple inchangé
    const cp = merged.betTypes.find((b) => b.betType === "couple_place");
    expect(cp?.totalPool).toBe(100);
  });
});
