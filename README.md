# Hit Forensics — CIS 5500 Final Project

**Team:** Kevin Li 🐐, Tommy Ou, Ronnie Wang, Kev Xue

A web application for forensic exploration of what makes a song a hit, built
on a join between 65 years of Billboard Hot 100 chart history (1958–2021) and
Spotify audio features for 447,000+ tracks. The database does the analytical
work; the app is a thin interactive surface over it.

Every page is backed by non-trivial SQL — multi-CTE chains, window functions,
self-joins on a junction table, and a GiST-indexed cube operator for k-NN
audio similarity.

---

## Repository layout

```
hit-forensics/
├── README.md
│
├── db/                         # Postgres artifacts
│   ├── queries.sql             #   All 10 production queries (Q1–Q10)
│   ├── optimization.sql        #   Indexes, materialized view, cube extension DDL
│   ├── timing.sql              #   EXPLAIN ANALYZE benchmarks (pre vs post optimization)
│   └── preprocessing.py        #   Data cleaning + entity resolution pipeline
│
├── server/                     # Express + pg backend
│   ├── index.js                #   Entry point
│   ├── app.js                  #   Express app + route mounting
│   ├── db.js                   #   Postgres connection pool
│   ├── routes/
│   │   ├── tracks.js           #   Q1, Q2, Q4, Q6, Q7, Q9 routes
│   │   ├── artists.js          #   Q3, Q10 + artist search
│   │   └── charts.js           #   Q5, Q8 routes
│   └── tests/                  #   Vitest + Supertest route tests
│
└── client/                     # React + Vite frontend
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx            #   Routing + nav layout
        ├── api.js              #   Fetch wrapper for all API endpoints
        ├── styles.css          #   Editorial design system (per DESIGN.md)
        └── pages/
            ├── HomePage.jsx
            ├── SearchPage.jsx
            ├── TrackPage.jsx           # Song Spotlight (radar + trajectory + twins)
            ├── WorkbenchPage.jsx       # Q7 audio feature filter
            ├── TrajectoryPage.jsx      # Q8 archetype gallery
            ├── EraDecoderPage.jsx      # Q9 decade outliers
            ├── ChemistryPage.jsx       # Q10 collab leaderboard
            ├── TopChartsPage.jsx       # Q5 longest-charting
            └── ArtistPage.jsx          # Q3 artist discography
```

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Database | PostgreSQL 17 on AWS RDS | Extensions: `pg_trgm`, `cube` |
| Backend | Node.js 20+, Express 4, `pg` 8 | ES modules, three route files |
| Frontend | React 18, React Router 6, Vite 5 | Component-driven, client-side routing |
| Charts | Recharts 3 | Radar, line, bar |
| Testing | Vitest 2, Supertest, React Testing Library | DB pool and api module mocked |
| Data pipeline | Python 3, pandas | Entity resolution and dedup |

---

## Datasets

| Dataset | Source | Rows |
|---|---|---|
| Spotify Tracks (1921–2020) | [Kaggle](https://www.kaggle.com/datasets/yamaerenay/spotify-dataset-19212020-600k-tracks) | ~587k raw |
| Billboard Hot 100 (1958–2021) | [Kaggle](https://www.kaggle.com/datasets/dhruvildave/billboard-the-hot-100-songs) | ~330k weekly entries |

After cleaning, deduplication, and entity resolution: ~447k canonical tracks
and ~230k chart entries. See the final report for the entity-resolution
methodology.

---

## Prerequisites

- Node 20+ and npm
- Access to the `music_db` Postgres instance on AWS RDS — credentials shared
  privately
- Python 3 + pandas (only if you want to re-run the data pipeline)

---

## Setup

### 1. Database credentials

```bash
cd server
cp .env.example .env             # then fill in PGHOST / PGUSER / PGPASSWORD
```

The frontend doesn't need DB credentials — `client/.env.example` only sets
`VITE_API_URL` and already defaults to `http://localhost:4000`.

### 2. Database optimization (one-time, on a fresh load)

The optimized queries depend on indexes, a materialized view
(`mv_charted_tracks`), and a `cube` column (`audio_cube`) that aren't in the
freshly-populated schema. Apply them once:

```bash
psql -h <RDS-host> -U <user> -d music_db -f db/optimization.sql
```

The script is idempotent (`IF NOT EXISTS` everywhere) and adds:

- `pg_trgm` GIN indexes on `tracks.track_name` and `artists.artist_name` (Q1)
- B-tree indexes on `chart_performance(track_id, week_date)` (Q4, Q8)
- Multi-column index on `tracks(danceability, energy, valence, tempo)` (Q7)
- Partial index on `track_artists(track_id) WHERE is_primary` (every route)
- `mv_charted_tracks` materialized view aggregating `chart_performance` per track
- `cube` extension + `audio_cube` column + GiST index for Q6 k-NN search

> The live RDS already has all of this applied — only re-run after a bulk
> reload. If `chart_performance` is reloaded, refresh the materialized view:
>
> ```sql
> REFRESH MATERIALIZED VIEW CONCURRENTLY mv_charted_tracks;
> ```

---

## Running the app locally

```bash
# Terminal 1 — backend
cd server
npm install
npm run dev                      # http://localhost:4000

# Terminal 2 — frontend
cd client
cp .env.example .env             # if you haven't already
npm install
npm run dev                      # http://localhost:5173
```

Health check: `curl http://localhost:4000/api/health` should return
`{"ok":true}`.

---

## API routes

| Method | Path | Query | Purpose |
|---|---|---|---|
| GET | `/api/health` | — | Liveness check |
| GET | `/api/tracks/search` | `q` | Q1 fuzzy track search |
| GET | `/api/tracks/workbench` | `danceability_min/max`, `energy_min/max`, `valence_min/max`, `tempo_min/max`, `limit` | Q7 multi-feature filter with NTILE decade percentiles |
| GET | `/api/tracks/outliers` | `decade?`, `limit` | Q9 decade-adjusted z-score outliers |
| GET | `/api/tracks/:id` | — | Q2 track detail with primary artist |
| GET | `/api/tracks/:id/chart` | — | Q4 weekly chart trajectory |
| GET | `/api/tracks/:id/similar` | `limit` | Q6 audio twin finder (cube `<->`) |
| GET | `/api/artists/search` | `q` | Artist name search |
| GET | `/api/artists/chemistry` | `limit` | Q10 collab chemistry leaderboard |
| GET | `/api/artists/:id` | — | Q3 artist detail + discography |
| GET | `/api/charts/top` | `limit` | Q5 longest-charting tracks |
| GET | `/api/charts/trajectories` | — | Q8 archetype classification + avg audio profile |

---

## Pages

| Route | Page | Backing query |
|---|---|---|
| `/` | Home | — (static feature grid) |
| `/search` | Track search | Q1 |
| `/track/:id` | Song Spotlight (radar fingerprint + chart trajectory + audio twins) | Q2 + Q4 + Q6 |
| `/workbench` | Audio Feature Workbench | Q7 |
| `/trajectories` | Trajectory Gallery (5 archetypes, overlaid radar) | Q8 |
| `/era-decoder` | Decade outlier table with z-score color coding | Q9 |
| `/chemistry` | Collab pair leaderboard | Q10 |
| `/top-charts` | Longest-charting tracks | Q5 |
| `/artist/:id` | Artist discography with chart stats | Q3 |

---

## Tests

Both packages use [Vitest](https://vitest.dev/). Server tests use Supertest
with the `pg` pool mocked — they never touch the real database. Client tests
use React Testing Library with the `api` module mocked.

```bash
cd server && npm test            # route tests
cd client && npm test            # component tests
```

---

## Performance benchmarks

`db/timing.sql` contains pre- and post-optimization versions of the four
complex queries (Q6, Q7, Q9, Q10) plus Q1 and Q8, side by side with
`EXPLAIN ANALYZE`. Run from psql:

```bash
psql -h <RDS-host> -U <user> -d music_db -f db/timing.sql
```

Headline post-optimization speedups: **~22× on Q6** (cube + GiST replaces
brute-force Euclidean) and **~31× on Q9** (materialized view replaces inline
CTE). Full timings and analysis are in the final report.

---

## Data preprocessing

The raw CSVs aren't checked in. To re-run the pipeline, drop them into a
`data/` folder at the repo root:

```
data/
├── tracks.csv          # Spotify
├── artists.csv         # Spotify
└── charts.csv          # Billboard
```

Then run from the repo root:

```bash
python db/preprocessing.py
```

It writes `Tracks.csv`, `Artists.csv`, `Track_Artists.csv`, and
`Chart_Performance.csv` to the current directory, ready for `\copy` into
Postgres. The pipeline:

1. Normalizes track and artist names — strips parentheticals/remix markers,
   removes accents via NFKD, drops punctuation.
2. Deduplicates Spotify tracks on `(normalized_title, normalized_primary_artist)`,
   keeping the highest-popularity row.
3. Resolves Billboard ↔ Spotify entities via bi-directional subset match on
   normalized artist token sets.
4. Populates `Track_Artists` with `is_primary = TRUE` on the lead artist for
   each track.
