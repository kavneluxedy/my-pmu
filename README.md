# PMU Suite — Suivi & optimisation pour parieur hippique

Application web **auto-hébergée** qui remplace les classeurs Excel du parieur : suivi des
dépenses/gains, fiches des chevaux favoris, et surtout un **simulateur d'optimisation des gains**
(tickets combinés, dutching, value bet). Données de cotes en saisie manuelle **ou** import
automatique depuis le PMU.

## Fonctionnalités

- **Tableau de bord** : profit net, ROI, taux de réussite, courbe de bankroll.
- **Mes paris** : enregistrement, statut (en attente / gagné / perdu), gain, suppression.
- **Mes chevaux** : fiches favoris (discipline, driver, hippodrome de prédilection, notes).
- **Simulateur** (cœur de l'outil) :
  - **Tickets combinés** — coût et nombre de combinaisons pour Trio, Tiercé, Quarté+, Quinté+,
    Couplé, en champ réduit (chevaux de base + champ associé), version ordre/désordre.
  - **Dutching** — répartition de mise pour un retour identique quel que soit le gagnant, à budget
    fixe ou pour viser un profit net garanti ; détection d'arbitrage.
  - **Value bet** — comparaison probabilité estimée vs cote, espérance de gain (EV), edge, et mise
    conseillée via le critère de Kelly fractionné (¼ Kelly).
- **Import PMU** : programme de la journée, partants et cotes, avec cache local.

## Architecture

Monorepo npm (workspaces) :

| Espace | Rôle |
| --- | --- |
| `packages/engine` | Moteur de calcul TypeScript pur (combinaisons, dutching, value bet, stats, provider PMU). Entièrement testé (Vitest). |
| `apps/api` | API REST Fastify + Prisma/SQLite. Délègue tous les calculs à l'engine. |
| `apps/web` | Frontend React + Vite + Recharts. |

## Prérequis

- Node.js ≥ 20

## Installation

```bash
npm install
cp apps/api/.env.example apps/api/.env      # crée la config locale (SQLite)
npm run build --workspace @pmu/engine       # compile le moteur (requis par l'API)
npm run db:migrate --workspace @pmu/api     # crée la base SQLite + applique le schéma
npm run db:seed --workspace @pmu/api        # (optionnel) jeu de données de démo
```

## Lancement (développement)

Dans deux terminaux :

```bash
npm run dev:api    # API sur http://localhost:3001
npm run dev:web    # UI  sur http://localhost:5173 (proxy /api vers l'API)
```

Puis ouvrez http://localhost:5173.

## Tests

```bash
npm test           # tests unitaires du moteur (@pmu/engine)
```

Le moteur est couvert par 43 tests (coûts de tickets, dutching, EV/Kelly, stats de bankroll,
parsing PMU).

## ⚠️ Import PMU — avertissement

L'import automatique s'appuie sur l'API **turfinfo** du PMU (`online.turfinfo.api.pmu.fr`), qui
**n'est pas un service public officiel documenté**. Elle est utilisée ici à titre **strictement
personnel** :

- les réponses sont **mises en cache 10 minutes** côté serveur (table `RawPmuSnapshot`) pour
  limiter les appels réseau ;
- toute la dépendance est **isolée** dans `packages/engine/src/providers/pmuTurfinfo.ts`, derrière
  l'interface `OddsProvider` : si l'API évolue ou devient indisponible, seul cet adaptateur est
  concerné et la **saisie manuelle reste pleinement fonctionnelle** ;
- respectez les CGU du PMU et la réglementation sur les paris (ANJ).

Cet outil est destiné au **suivi et à la simulation** : il ne place aucun pari automatiquement.

## Sauvegarde

Toute la donnée tient dans le fichier SQLite `apps/api/pmu.db`. Une sauvegarde = une copie de ce
fichier.
