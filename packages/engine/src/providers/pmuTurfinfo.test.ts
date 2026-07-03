import { describe, expect, it } from "vitest";
import {
  PmuTurfinfoProvider,
  extractOdds,
  mapDiscipline,
  normalizeRunner,
  toPmuDate,
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
