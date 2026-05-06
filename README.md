# Hit Forensics — CIS 5500 Final Project

**Team:** Kevin Li 🐐, Tommy Ou, Ronnie Wang, Kev Xue

A web application for exploring what makes a song a hit, built on a joined
Spotify and a Billboard Hot 100 dataset (1958–2021). The database does the
analytical work and the application is a thin interactive surface over it.

Every page is backed by fancy non-trivial SQL like multi-CTE chains, window functions,
self-joins on a junction table, and a GiST-indexed cube
operator for k-NN audio similarity.

---

## Repository layout

```
cis-5500-final-project/
├── Milestone2.md              # Project outline: features, schema, ER diagram, DDL
├── Milestone3.md               # DB population, queries, pre-optimization timings, 3NF justification
├── queries.sql                 # All 10 production queries (Q1–Q10)
├── preprocessing.py            # Data cleaning + entity resolution pipeline
├── optimization.sql            # Indexes, materialized view, cube extension DDL
├── timing.sql                  # EXPLAIN ANALYZE benchmarks (pre vs post optimization)
│
├── server/                     # Express + pg backend
│   ├── index.js                # Entry point
│   ├── app.js                  # Express app + route mounting
│   ├── db.js                   # Postgres connection pool
│   ├── routes/
│   │   ├── tracks.js           # Q1, Q2, Q4, Q6, Q7, Q9 routes
│   │   ├── artists.js          # Q3, Q10 + artist search
│   │   └── charts.js           # Q5, Q8 routes
│   └── tests/                  # Vitest + Supertest route tests
│
└── client/                     # React + Vite frontend
    ├── index.html
    ├── vite.config.js
    └── src/
        ├── main.jsx            # Routing + nav layout
        ├── api.js              # Fetch wrapper for all API endpoints
        ├── styles.css          # Dark-theme styles
        └── pages/
            ├── HomePage.jsx
            ├── SearchPage.jsx
            ├── TrackPage.jsx           # Song Spotlight (radar + trajectory)
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
| Database | PostgreSQL 17 on AWS RDS | Extensions: `pg_trgm`, `cube` (after running `optimization.sql`) |
| Backend | Node.js 20+ + Express 4 | ES modules, pg pool, three route files |
| Frontend | React 18 + React Router 6 + Vite 5 | Component-based, client-side routing |
| Charts | Recharts 2 | Radar charts, line charts, bar charts |
| Testing | Vitest + Supertest + React Testing Library | Server pool mocked, api module mocked |
| Data pipeline | Python 3 + pandas | Entity resolution and dedup |


---

## Prerequisites

- Node 20+
- npm
- Access to the Postgres instance documented in [Milestone3.md](Milestone3.md)
  (made sure guest credentials are shared privately so don't end up on the GitHub boom)

---

## Running the app locally

```bash
# 1. backend
cd server
cp .env.example .env        # fill in PGUSER / PGPASSWORD
npm install
npm run dev                 # http://localhost:4000

# 2. frontend (in a second terminal)
cd client
cp .env.example .env        # VITE_API_URL defaults to http://localhost:4000
npm install
npm run dev                 # http://localhost:5173
```

Health check: `curl http://localhost:4000/api/health` should return `{"ok":true}`.

---

## Database optimization (required before first run)

The server's optimized queries reference a materialized view (`mv_charted_tracks`)
and a cube column (`audio_cube`) that don't exist in the freshly-populated
schema. Apply them once:

```bash
psql -h <RDS-host> -U <user> -d music_db -f optimization.sql
```

This script is idempotent (uses `IF NOT EXISTS` everywhere) and includes:

- `pg_trgm` GIN indexes on `tracks.track_name` and `artists.artist_name` (Q1)
- B-tree indexes on `chart_performance(track_id, week_date)` (Q4, Q8)
- Multi-column index on `tracks(danceability, energy, valence, tempo)` (Q7)
- Partial index on `track_artists(track_id) WHERE is_primary` (every route)
- `mv_charted_tracks` materialized view aggregating chart_performance per track
- `cube` extension + `audio_cube` column + GiST index for Q6 k-NN search

When `chart_performance` is reloaded, refresh the materialized view:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_charted_tracks;
```

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

## Running the tests

Both packages use [Vitest](https://vitest.dev/). The server tests use
Supertest(but never touches our actual database).The client tests use React Testing Library.

```bash
cd server && npm test   # route tests
cd client && npm test   # component tests
```

---

## Performance benchmarks

Run `psql -f timing.sql` against the database to compare pre- and
post-optimization plans for the four complex queries (Q6, Q7, Q9, Q10) plus
Q1 and Q8. Each query block contains both versions side by side with
`EXPLAIN ANALYZE`. Pre-optimization baseline timings are recorded in
[Milestone3.md](Milestone3.md#pre-optimization-timings).

---

## Data preprocessing

Raw CSVs (Spotify tracks, Spotify artists, Billboard Hot 100) are wrangled
by `preprocessing.py`:

1. Title and artist names normalized (parentheticals/remix markers stripped,
   accents removed via NFKD, punctuation dropped).
2. Spotify deduplication on `(normalized_title, normalized_primary_artist)`,
   keeping the highest-popularity row.
3. Entity resolution between Spotify and Billboard via bi-directional subset
   match on normalized artist token sets.
4. Genres exploded from stringified Python lists into the `Artist_Genres`
   junction.

