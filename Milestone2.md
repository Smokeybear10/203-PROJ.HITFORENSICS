# CIS 5500 Project Milestone 2

**Team:** Kevin Li, Tommy Ou, Ronnie Wang, Kev Xue

---

## 1. Motivation

What makes a song a hit? The music industry generates tens of billions of dollars annually, yet the relationship between a song's sonic DNA and its commercial trajectory remains folklore. Artists, producers, and labels invest hundreds of thousands of dollars into a single track on instinct. Music critics argue. Streaming platforms optimize in the dark. Nobody has built a public tool that lets a curious listener — let alone a working producer — ask precise, answerable questions about *what actually succeeds*.

This project fills that gap. We combine Spotify's 11-dimensional audio feature vectors with 65 years of Billboard Hot 100 chart history (1958–2021) into a single queryable system, and we put it behind an interactive web interface that feels less like a database browser and more like a forensic lab.

The core thesis is that the joint dataset is far greater than the sum of its parts. Spotify alone knows what songs *sound* like; Billboard alone knows what songs *sold*. Joined, you can ask questions no existing tool answers:

- Do songs with rising-then-sustained chart trajectories share a distinct sonic profile, or is the shape of a hit independent of its sound?
- Which songs were "ahead of their time" — z-score outliers against their decade's sonic norms that still charted successfully?
- Given any song, what are its ten closest audio twins, and did they chart similarly?
- Which artist collaborations produce the highest average peak rank relative to each artist's solo output ("chemistry")?
- How has the average danceability, valence, and energy of a #1 hit drifted since 1960 — and in which decade did the drift accelerate?

The application makes all of these live queries, not pre-rendered infographics. Users drive the exploration; the database does the thinking.

---

## 2. Core Features (will definitely implement)

### 2.1 Song Spotlight
A user searches by track or artist and lands on a detail page showing the track's full 11-dimensional audio fingerprint alongside its weekly chart trajectory. The audio fingerprint is rendered as a radar chart; the chart trajectory is a line plot with annotations for debut week and peak week. The page also shows contextual comparisons — how this song's features compare to its decade average and to its genre average — computed live from a single SQL query.

**Query highlight:** one round-trip returns track details, chart trajectory, and contextual means using a CTE plus window functions in a single statement.

### 2.2 Audio Feature Workbench
An interactive filtering interface. Users set multi-dimensional ranges (danceability > 0.7, energy 0.5–0.8, tempo 120–130 BPM) and receive a ranked, paginated table of matches with summary statistics computed against the filter population:

- Average peak rank inside the filter versus the global average via correlated subquery.
- Decade-level chart longevity percentile for each result via `NTILE(100) OVER (PARTITION BY decade)`.
- A "surprise score" showing how each song's peak rank diverges from what a simple feature-based baseline would predict (residuals computed in SQL).

The Workbench is the flagship query surface. Every filter permutation triggers a non-trivial analytical query — not a simple `WHERE` clause.

### 2.3 Audio Twin Finder
User picks any song; the system returns the ten tracks with the closest audio-feature profiles in Euclidean distance across the 11 dimensions, along with their own chart performance. Implemented using Postgres's `cube` extension for multi-dimensional distance queries, indexed by GiST for sub-second lookups across ~500k tracks.

The output is displayed as a scatter plot (2-D projection on the two highest-variance dimensions) plus a ranked table. This feature is the strongest demo-day hook — it feels like magic, but it's a pure SQL operation.

### 2.4 Trajectory Gallery
Every charting song has a *shape*: when did it debut, when did it peak, how fast did it fall off? The Gallery classifies songs into five archetypes using window-function analysis of `Chart_Performance`:

| Archetype | Definition |
|---|---|
| Flash | Peaks within 3 weeks of debut, drops off the chart within 10 |
| Sleeper | Debuts below rank 50, climbs to peak ≥20 weeks later |
| Slow Burn | Peak ≥10 weeks after debut, total run ≥25 weeks |
| Sustained Hit | Peaks in top 10 and stays in top 40 for ≥15 weeks |
| Comeback | Re-enters the chart ≥6 months after initial fall-off |

Classification is a CTE using `FIRST_VALUE`, `LAG`, and `ROW_NUMBER` window functions over `Chart_Performance` partitioned by track. Users click any archetype to see its sonic profile — whether "Sleeper" hits sound different from "Flash" hits on average.

### 2.5 Era Decoder
For each track, we compute era-adjusted z-scores: how many standard deviations each audio feature sits from the mean of all tracks released in the same decade. Users can filter for "ahead of their time" tracks — high-peak songs that scored as sonic outliers in their own decade. The decoder surfaces, for instance, that specific 1980s hits would have sounded at home in the 2000s.

**Query highlight:** pure-SQL per-decade aggregation joined back to per-track rows via window functions over decade partitions.

### 2.6 One-Hit Wonders vs. Chart Staples
A dedicated query comparing the average audio profile of tracks that peaked in the top 10 but charted briefly (≤2 weeks in the top 40) against tracks that charted for ≥52 weeks. Rendered as overlaid radar charts. Also shows the top three features with the largest mean gap between groups, computed with `GROUP BY` + `HAVING` against the `Track_Summary` materialized view.

### 2.7 Collab Chemistry
Using the `Track_Artists` junction, we compute for every artist pair that has collaborated on two or more tracks: the average peak rank of their joint output versus the average peak rank of each artist's solo catalog. Pairs with the largest uplift are ranked as "high chemistry." This is a graph-flavored query over a relational junction — the kind of thing databases handle well and application servers handle poorly.

### 2.8 Trend Pulse (Trend Analysis Dashboard)
Time-series visualizations: evolution of mean audio features among #1 hits over time, with 5-year rolling averages. Overlay toggles for top-10 vs top-40 vs all charting songs let users compare tiers. Backed by a materialized view refreshed nightly.

---

## 3. Stretch Features

### 3.1 Lyric Lab *(requires Genius API integration)*
For a subset of tracks (top ~5,000 by chart longevity), we ingest lyrics from the Genius API and compute:
- Word count, unique word count, lexical diversity
- Average word length, sentiment score (VADER), first-person density

The Lyric Lab lets users correlate lyrical features with chart outcomes and audio features — "do simpler lyrics correlate with longer chart runs?", "are happier-sounding songs (high valence) also happier in lyrics (high sentiment)?" Adds an entire new axis of analysis orthogonal to the Spotify audio features.

### 3.2 Genre Translator
Pick a genre and an era, see its characteristic sonic profile. Compare two era/genre combinations side-by-side: "Hip-Hop in 1995 vs Hip-Hop in 2015." Highlights which audio dimensions drifted most.

### 3.3 Predict My Chart Rank
A linear regression model trained in Python on the joined dataset. User provides audio feature values; the model returns a predicted peak rank with a confidence interval. Served as a thin API endpoint; the model is a pickled sklearn artifact loaded by the Express backend via a Python subprocess call. Intentionally simple — the point is to illustrate a baseline, not win a Kaggle contest.

### 3.4 Head-to-Head Artist Comparison
Side-by-side radar charts and chart-history overlays for any two artists.

### 3.5 Query Studio
A read-only SQL editor embedded in the site that lets advanced users write their own `SELECT` queries against the database. Scoped to a restricted schema view with query timeouts. Shows off the DB layer directly.

---

## 4. Web Pages

| Page | Purpose | Backing Query Complexity |
|---|---|---|
| **Home** | Thesis, search bar, "Query of the Day" surprising finding, live counters | Cached daily aggregate |
| **Song Spotlight** | Per-track detail, audio fingerprint, chart trajectory, era/genre context | CTE + window functions |
| **Audio Feature Workbench** | Multi-dimensional audio filter, ranked results, comparative statistics | Correlated subquery + NTILE + residual computation |
| **Audio Twin Finder** | k-NN in audio feature space with chart outcomes | `cube` extension + GiST index |
| **Trajectory Gallery** | Five chart-trajectory archetypes, sonic profile per archetype | Window functions + CTE classification |
| **Era Decoder** | Z-score outlier surfacing, era-adjusted rankings | Window functions partitioned by decade |
| **Trend Pulse** | Time-series audio feature evolution, #1 hit sonic drift | Materialized view with rolling aggregates |
| **Artist Profile** | Per-artist discography, career stats, audio variance | Multi-table aggregate with junction join |
| **Collab Chemistry** | Ranked artist-pair uplift leaderboard | Self-join on junction + per-artist baselines |

---

## 5. ER Diagram

Six entities plus one materialized summary view. In text form:

```
      Artists  ───<Artist_Genres>───  Genres
         │
         │
   <Track_Artists>
         │
         │
       Tracks
         │
         │
   Chart_Performance (weekly granularity)
         │
         ▼
   Track_Summary (materialized view, one row per track)
```

**Entities:**
- **Artists** — one row per artist (name, followers, popularity)
- **Genres** — normalized lookup table of unique genre tags
- **Artist_Genres** — junction (many-to-many: artists ↔ genres)
- **Tracks** — one row per song (audio features, metadata)
- **Track_Artists** — junction (many-to-many: tracks ↔ artists) with `is_primary` flag
- **Chart_Performance** — one row per (track, week) — raw weekly Billboard data
- **Track_Summary** *(materialized view)* — one row per charted track with pre-aggregated stats (best peak rank, total weeks, debut date, trajectory archetype, debut decade)

**Key relationships:**
- Each track has one or more artists via `Track_Artists`, with exactly one marked `is_primary = TRUE`.
- Each artist can have zero or more genres via `Artist_Genres`. Track genre is inferred via the primary artist's genres (documented limitation).
- Each track can have zero or more `Chart_Performance` rows (tracks that never charted have none).
- `Track_Summary` is derived from `Chart_Performance` and refreshed nightly.

---

## 6. SQL DDL

```sql
CREATE TABLE Artists (
    artist_id        INTEGER PRIMARY KEY,
    artist_name      VARCHAR(255) NOT NULL,
    followers        BIGINT,
    popularity       INTEGER CHECK (popularity BETWEEN 0 AND 100)
);

CREATE TABLE Genres (
    genre_id         SERIAL PRIMARY KEY,
    genre_name       VARCHAR(100) NOT NULL UNIQUE
);

CREATE TABLE Artist_Genres (
    artist_id        INTEGER NOT NULL REFERENCES Artists(artist_id) ON DELETE CASCADE,
    genre_id         INTEGER NOT NULL REFERENCES Genres(genre_id) ON DELETE CASCADE,
    PRIMARY KEY (artist_id, genre_id)
);

CREATE TABLE Tracks (
    track_id         INTEGER PRIMARY KEY,
    track_name       VARCHAR(255) NOT NULL,
    duration_ms      INTEGER,
    time_signature   SMALLINT,
    key              SMALLINT,
    tempo            NUMERIC(6, 3),
    mode             SMALLINT,
    explicit         BOOLEAN,
    popularity       INTEGER CHECK (popularity BETWEEN 0 AND 100),
    instrumentalness NUMERIC(4, 3),
    speechiness      NUMERIC(4, 3),
    danceability     NUMERIC(4, 3),
    acousticness     NUMERIC(4, 3),
    loudness         NUMERIC(5, 2),
    liveness         NUMERIC(4, 3),
    valence          NUMERIC(4, 3),
    energy           NUMERIC(4, 3),
    release_year     SMALLINT
);

CREATE TABLE Track_Artists (
    track_id         INTEGER NOT NULL REFERENCES Tracks(track_id) ON DELETE CASCADE,
    artist_id        INTEGER NOT NULL REFERENCES Artists(artist_id) ON DELETE CASCADE,
    is_primary       BOOLEAN NOT NULL DEFAULT FALSE,
    PRIMARY KEY (track_id, artist_id)
);

CREATE TABLE Chart_Performance (
    track_id         INTEGER NOT NULL REFERENCES Tracks(track_id) ON DELETE CASCADE,
    week_date        DATE NOT NULL,
    current_rank     INTEGER NOT NULL CHECK (current_rank BETWEEN 1 AND 100),
    peak_rank        INTEGER NOT NULL CHECK (peak_rank BETWEEN 1 AND 100),
    weeks_on_chart   INTEGER NOT NULL CHECK (weeks_on_chart >= 1),
    PRIMARY KEY (track_id, week_date)
);

-- Materialized view: one row per track with pre-aggregated chart statistics
CREATE MATERIALIZED VIEW Track_Summary AS
SELECT
    t.track_id,
    MIN(cp.week_date)                                    AS debut_date,
    MIN(cp.peak_rank)                                    AS best_peak_rank,
    MAX(cp.weeks_on_chart)                               AS total_weeks_on_chart,
    COUNT(*)                                             AS chart_week_count,
    EXTRACT(YEAR FROM MIN(cp.week_date))::INT            AS debut_year,
    (EXTRACT(YEAR FROM MIN(cp.week_date))::INT / 10) * 10 AS debut_decade
FROM Tracks t
JOIN Chart_Performance cp USING (track_id)
GROUP BY t.track_id;

CREATE UNIQUE INDEX ON Track_Summary (track_id);
```

### 6.1 Indexes

```sql
-- Fuzzy search on track and artist names (for search autocomplete)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_tracks_name_trgm  ON Tracks  USING GIN (track_name gin_trgm_ops);
CREATE INDEX idx_artists_name_trgm ON Artists USING GIN (artist_name gin_trgm_ops);

-- Multi-column index for the Audio Feature Workbench filters
CREATE INDEX idx_tracks_features ON Tracks (danceability, energy, valence, tempo);

-- Chart history and aggregation
CREATE INDEX idx_chart_perf_week ON Chart_Performance (week_date);

-- Junction traversal
CREATE INDEX idx_track_artists_artist ON Track_Artists (artist_id);
CREATE INDEX idx_artist_genres_genre  ON Artist_Genres (genre_id);

-- Multi-dimensional nearest-neighbor for the Audio Twin Finder
CREATE EXTENSION IF NOT EXISTS cube;
CREATE INDEX idx_tracks_audio_cube ON Tracks USING GIST (
    cube(ARRAY[
        danceability,
        energy,
        valence,
        acousticness,
        instrumentalness,
        speechiness,
        liveness,
        tempo / 300.0,
        (loudness + 60.0) / 60.0
    ])
);
```

The cube index is the technical unlock for the Audio Twin Finder — turning what would be a full table scan into a sub-second nearest-neighbor lookup. Tempo and loudness are pre-scaled into [0, 1] so no single dimension dominates the Euclidean metric. Categorical features (`key`, `mode`, `time_signature`) are excluded from the similarity space.

---

## 7. Cleaning / Preprocessing

### 7.1 Spotify tracks
- Drop rows with null critical audio features; impute non-critical fields (e.g., popularity → 0).
- Normalize track titles: strip parenthesized suffixes, split on " - " and "/" to remove remaster/remix/radio-edit variants, lowercase, strip accents via Unicode NFKD decomposition, strip punctuation.
- Deduplicate on (normalized_title, normalized_primary_artist), keeping the version with highest Spotify popularity (most likely the canonical release).
- Parse `id_artists` (stringified Python list) into junction rows, marking the first entry as `is_primary = TRUE`.

### 7.2 Billboard Hot 100
- Parse `date` column into proper `DATE` type.
- Normalize titles and artists with the same function used on Spotify — critical for join consistency.
- Strip collaboration markers ("featuring", "feat", "ft", "with", "and") from Billboard artist names so "Drake Featuring Rihanna" becomes comparable to Spotify's "Drake, Rihanna".

### 7.3 Entity resolution
The join is a bi-directional subset match on normalized artist tokens. For every Billboard row we find Spotify candidates with the matching normalized song title, then accept a candidate if the token set of one artist name is a subset of the other. This handles:

- Billboard "Drake Featuring Rihanna" ↔ Spotify "Drake, Rihanna"
- Billboard "Beyoncé" ↔ Spotify "Beyonce" (after accent stripping)
- Billboard "Eminem" ↔ Spotify "Eminem, Dr. Dre" (Eminem tokens are a subset)

Disjoint token sets are rejected, correctly filtering out "Drake" the rapper from "Drake Bell" the actor. We report a match rate and a sample of rejected pairs for manual review.

### 7.4 Genre normalization
Spotify's artist CSV stores genres as a stringified Python list. We parse it with `ast.literal_eval`, explode into rows, and populate `Genres` + `Artist_Genres`. Track-level genre is inferred via the primary artist's genres — a documented approximation. A future enhancement could pull track-level genre from MusicBrainz, but the artist-level approximation is sufficient for Milestone 3.

### 7.5 Temporal coverage
Billboard coverage begins in 1958; Spotify audio features exist for essentially all post-1990 tracks and sporadic pre-1990 tracks. We retain all Billboard rows in `Chart_Performance` (so chart-only queries work for the full era), but audio-feature queries naturally filter down to the matched subset. The UI surfaces coverage statistics: "Showing X tracks from Y distinct chart weeks — Z% of all Hot 100 entries since 1958."

### 7.6 Data volume (estimated)
| Table | Row count |
|---|---|
| Tracks (after dedup) | ~400k–500k |
| Chart_Performance | ~330k (100 × weekly × 65 years) |
| Matched tracks with chart data | ~25k–40k |
| Artists | ~80k |
| Genres | ~3k |
| Artist_Genres | ~200k |

### 7.7 Reproducibility
All preprocessing lives in a single Python script under version control (`preprocessing.py`). Running it from raw CSVs regenerates the load-ready CSVs for Postgres ingestion. A Makefile target (`make db`) runs the full pipeline end-to-end and rebuilds the materialized view.

---

## 8. Technology Stack

| Layer | Technology | Rationale |
|---|---|---|
| Database | PostgreSQL 16 with `cube`, `pg_trgm`, `tablefunc` extensions | Window functions, CTEs, and GiST cube indexes are first-class; free and portable |
| Backend | Node.js with Express.js | Simple query-to-endpoint wiring; team familiarity |
| Frontend | React.js (Vite) | Component-driven UI; fast dev cycle |
| Visualization | Recharts for standard charts; D3 for the Audio Twin scatter | Recharts handles 80%; D3 for the custom k-NN view |
| Data cleaning | Python + pandas | Team standard; reproducible |
| Version control | GitHub | Protected main branch, PR reviews |
| Deployment | AWS RDS (Postgres) + Render (Express) + Vercel (frontend) | Zero-config prod-like hosting |

---

## 9. Team Responsibilities

| Member | Focus | Key Deliverables |
|---|---|---|
| **Kevin Li** | Data engineering, schema, complex query authoring | Preprocessing pipeline, DDL, `Track_Summary` materialized view, Trajectory Gallery query, Era Decoder query, One-Hit Wonder query |
| **Kev Xue** | Backend API, query performance, deployment | Express routes, query parameterization, pagination, indexes, explain-plan tuning, Audio Twin Finder cube query, Postgres setup on RDS |
| **Tommy Ou** | Frontend architecture, Song Spotlight, Artist Profile, Audio Feature Workbench UI | React app scaffolding, routing, Song Spotlight page, Artist Profile page, Workbench filter controls, API integration layer |
| **Ronnie Wang** | Data visualization, Trend Pulse, Trajectory Gallery UI | Recharts components, D3 scatter for Audio Twin Finder, Trend Pulse dashboard, responsive styling, design system |

Every team member owns at least one end-to-end query (SQL → API → UI) so everyone touches the full stack.

---

## 10. What Makes This Project Stand Out

Most database course projects are CRUD apps with pretty dashboards bolted on. This project is different because:

1. **Every feature is a non-trivial SQL query.** No page renders a `SELECT * FROM Tracks WHERE id = ?`. The simplest query in the app is a CTE with a window function. The most complex is a seven-way join with a correlated subquery and a cube-indexed k-NN lookup.
2. **The database does the thinking, not the application server.** Trajectory classification, era-adjusted z-scores, collab chemistry, and twin finding all happen in the query layer. Express is a thin pass-through — not a computation engine.
3. **The data integration is genuinely hard.** Matching 330k Billboard rows against 500k Spotify rows across 65 years of inconsistent title conventions and accented names is a real entity resolution problem, and our bi-directional subset approach is defensible and demonstrably effective.
4. **Performance is considered from schema design.** Materialized views, multi-column indexes, trigram indexes for fuzzy search, and cube indexes for similarity search are in the schema from day one, not afterthoughts. The final report will include explain plans for our three most complex queries.
5. **The framing is sharper than "music data explorer."** The application is a forensic lab. Every page is a specific investigative lens. That framing shapes scope, UX, and the final demo narrative.

---

## 11. Risk and Scope Management

### Known risks
- **Entity resolution false positives.** Mitigation: spot-check the lowest-popularity 1% of matches; add a popularity threshold on Spotify tracks if needed.
- **Spotify audio features are missing for pre-1990 Billboard hits.** Mitigation: surface coverage statistics in the UI, gracefully degrade for years with low match rates.
- **The `cube` extension requires install privileges on Postgres.** Mitigation: confirmed available on AWS RDS; fallback is an in-memory k-NN computed in the Express layer for small result sets.
- **Lyric Lab depends on Genius API availability and rate limits.** Mitigation: Lyric Lab is explicitly stretch scope; core features function without it.

### Scope ladder (priority order)
1. Core schema + four flagship queries (Workbench, Trajectory, Era Decoder, One-Hit Wonder) — **non-negotiable for Milestone 3**
2. Audio Twin Finder + Collab Chemistry
3. Trend Pulse dashboard
4. Artist Profile + comparisons
5. Stretch: Lyric Lab, Predict My Chart Rank, Query Studio

We'd rather ship a tight, polished core than a sprawling surface with half-finished pages. Items 1 and 2 are the minimum bar for a strong grade. Items 3 and 4 round out the experience. Item 5 exists if the team finishes ahead of schedule.
