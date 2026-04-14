# CIS 5500 Milestone 3

Team: Kevin Li, Tommy Ou, Ronnie Wang, Kev Xue

## Database Access

The database is a PostgreSQL 17 instance on AWS RDS.

```
Host:     song-database.cakclnasdurs.us-east-1.rds.amazonaws.com
Port:     5432
Database: music_db
```

Guest credentials for the TA are in a separate file shared privately so they don't end up on GitHub. Connect with:

```
psql -h song-database.cakclnasdurs.us-east-1.rds.amazonaws.com -p 5432 -U <user> -d music_db
```

## Table Sizes

| Table | Rows |
|---|---|
| artists | 79,822 |
| tracks | 447,196 |
| track_artists | 568,810 |
| chart_performance | 247,447 |

## Schema

```
artists(artist_id PK, artist_name, followers, genres, popularity)

tracks(track_id PK, track_name, duration_ms, time_signature, key, tempo,
       mode, explicit, popularity, instrumentalness, speechiness,
       danceability, acousticness, loudness, liveness, valence, energy)

track_artists(track_id FK, artist_id FK, is_primary)
    -- composite PK on (track_id, artist_id)

chart_performance(chart_id PK, track_id FK, week_date,
                  current_rank, peak_rank, weeks_on_chart)
```

`track_artists` resolves the many-to-many between tracks and artists, with `is_primary` flagging the lead artist. `chart_performance` stores one row per track per week, so a track's full weekly history is `SELECT ... WHERE track_id = ?` ordered by week_date.

## 3NF Justification

The schema is in 3NF. Going table by table:

- **artists**: `artist_name`, `followers`, `genres`, and `popularity` all depend on `artist_id` alone. No partial or transitive dependencies.
- **tracks**: every audio feature and metadata column depends on `track_id`. The audio features are atomic numeric values that don't depend on each other.
- **track_artists**: `is_primary` depends on both `track_id` and `artist_id` together (it describes which artist is the lead on which track). The composite key is minimal.
- **chart_performance**: `current_rank`, `peak_rank`, and `weeks_on_chart` depend on the natural key `(track_id, week_date)`. `chart_id` is a surrogate PK we added for convenience.

The one mild denormalization is `artists.genres`, which we store as a TEXT blob (the stringified Python list straight from the Spotify dataset). Strictly normalizing would mean splitting this into a `genres` lookup and an `artist_genres` junction, but we don't use genre filtering as a primary operation so we left it as a text column.

## Queries

Ten queries total. Q1 through Q5 are simple lookups and aggregations. Q6 through Q10 are the four-plus complex queries that draw on multiple tables, use CTEs, window functions, or subqueries, and produce non-trivial results.

### Q1: Fuzzy song search

Search by partial track name and sort by Spotify popularity.

```sql
SELECT track_id, track_name, popularity
FROM tracks
WHERE track_name ILIKE '%blinding lights%'
ORDER BY popularity DESC
LIMIT 20;
```

### Q2: Track detail with primary artist

Return the full audio fingerprint for one track together with its primary artist's name.

```sql
SELECT t.track_id, t.track_name, a.artist_name,
       t.danceability, t.energy, t.valence, t.acousticness,
       t.instrumentalness, t.speechiness, t.liveness,
       t.tempo, t.loudness, t.key, t.mode, t.time_signature,
       t.explicit, t.popularity
FROM tracks t
JOIN track_artists ta ON t.track_id = ta.track_id AND ta.is_primary = TRUE
JOIN artists a        ON ta.artist_id = a.artist_id
WHERE t.track_id = 7;
```

### Q3: Artist discography

Every track by a named artist, with that track's best peak rank and total weeks on chart.

```sql
SELECT t.track_name,
       t.popularity,
       MIN(cp.peak_rank)      AS best_peak_rank,
       MAX(cp.weeks_on_chart) AS total_weeks_on_chart
FROM artists a
JOIN track_artists ta ON a.artist_id = ta.artist_id
JOIN tracks t         ON ta.track_id = t.track_id
LEFT JOIN chart_performance cp ON t.track_id = cp.track_id
WHERE a.artist_name = 'Drake'
GROUP BY t.track_id, t.track_name, t.popularity
ORDER BY t.popularity DESC
LIMIT 50;
```

### Q4: Chart trajectory for a track

Pulls every week a track appeared on the Hot 100 so we can plot its rise and fall.

```sql
SELECT week_date, current_rank, peak_rank, weeks_on_chart
FROM chart_performance
WHERE track_id = (
    SELECT track_id FROM tracks WHERE track_name ILIKE 'shape of you' LIMIT 1
)
ORDER BY week_date;
```

### Q5: Top 20 longest-charting songs

Tracks with the most cumulative weeks on the Billboard Hot 100 ever.

```sql
SELECT t.track_name,
       MAX(cp.weeks_on_chart) AS total_weeks,
       MIN(cp.peak_rank)      AS best_peak
FROM tracks t
JOIN chart_performance cp ON t.track_id = cp.track_id
GROUP BY t.track_id, t.track_name
ORDER BY total_weeks DESC
LIMIT 20;
```

### Q6: Audio similarity search (complex)

For every Billboard #1 hit, find tracks with nearly identical audio profiles across five feature dimensions. Written as a cross join with a Euclidean distance calculation in the WHERE clause. Without any supporting index, this evaluates roughly 530 million track pairs and takes around 17 minutes. Milestone 5 will speed this up with the Postgres `cube` extension and a GiST index.

```sql
WITH number_ones AS (
    SELECT DISTINCT ON (t.track_id)
           t.track_id, t.track_name,
           t.danceability, t.energy, t.valence,
           t.acousticness, t.instrumentalness
    FROM tracks t
    JOIN chart_performance cp USING (track_id)
    WHERE cp.peak_rank = 1
)
SELECT n1.track_name AS hit,
       t2.track_name AS similar_track,
       ROUND(SQRT(POWER(n1.danceability     - t2.danceability, 2)
                + POWER(n1.energy           - t2.energy, 2)
                + POWER(n1.valence          - t2.valence, 2)
                + POWER(n1.acousticness     - t2.acousticness, 2)
                + POWER(n1.instrumentalness - t2.instrumentalness, 2))::numeric, 4) AS audio_distance
FROM number_ones n1
CROSS JOIN tracks t2
WHERE t2.track_id <> n1.track_id
  AND POWER(n1.danceability     - t2.danceability, 2)
    + POWER(n1.energy           - t2.energy, 2)
    + POWER(n1.valence          - t2.valence, 2)
    + POWER(n1.acousticness     - t2.acousticness, 2)
    + POWER(n1.instrumentalness - t2.instrumentalness, 2) < 0.0001
ORDER BY n1.track_name, audio_distance
LIMIT 100;
```

### Q7: Multi-feature filter with per-decade percentile ranking (complex)

Filters charting tracks by audio feature ranges (e.g. danceability > 0.7, tempo 110-130 BPM), then for each result computes its chart-longevity percentile within its debut decade using `NTILE`. Also compares the filtered set's average peak rank against the global average using a scalar subquery. Uses a CTE for the per-track chart aggregation, an NTILE window function partitioned by decade, and multiple joins.

```sql
WITH track_debut AS (
    SELECT cp.track_id,
           (EXTRACT(YEAR FROM MIN(cp.week_date))::int / 10) * 10 AS debut_decade,
           MIN(cp.peak_rank)      AS best_peak,
           MAX(cp.weeks_on_chart) AS total_weeks
    FROM chart_performance cp
    GROUP BY cp.track_id
)
SELECT t.track_name,
       t.danceability, t.energy, t.valence, t.tempo,
       d.debut_decade,
       d.best_peak,
       d.total_weeks,
       NTILE(100) OVER (PARTITION BY d.debut_decade ORDER BY d.total_weeks)
           AS decade_longevity_percentile,
       (SELECT ROUND(AVG(best_peak)::numeric, 2) FROM track_debut) AS global_avg_peak
FROM tracks t
JOIN track_debut d ON t.track_id = d.track_id
WHERE t.danceability > 0.70
  AND t.energy BETWEEN 0.50 AND 0.90
  AND t.tempo  BETWEEN 110  AND 130
ORDER BY d.best_peak ASC
LIMIT 100;
```

### Q8: Chart trajectory classification (complex)

Every charting track has a shape: how fast it peaked, how long it stayed. This query uses `FIRST_VALUE` window functions over `chart_performance` to extract each track's debut rank and peak week, then uses a CASE expression to bucket tracks into five categories (Flash, Sleeper, Slow Burn, Sustained Hit, Other). The final SELECT joins back to `tracks` and reports the average audio profile per bucket.

```sql
WITH chart_stats AS (
    SELECT track_id,
           MIN(week_date)       AS debut_date,
           MIN(current_rank)    AS best_rank,
           MAX(weeks_on_chart)  AS total_weeks
    FROM chart_performance
    GROUP BY track_id
),
debut_peak AS (
    SELECT DISTINCT track_id,
           FIRST_VALUE(current_rank) OVER (PARTITION BY track_id ORDER BY week_date) AS debut_rank,
           FIRST_VALUE(week_date)    OVER (PARTITION BY track_id ORDER BY current_rank ASC, week_date ASC) AS peak_week
    FROM chart_performance
),
labeled AS (
    SELECT cs.track_id,
           CASE
               WHEN cs.total_weeks <= 10 AND (dp.peak_week - cs.debut_date) <= 21 THEN 'Flash'
               WHEN dp.debut_rank > 50  AND (dp.peak_week - cs.debut_date) >= 140 THEN 'Sleeper'
               WHEN (dp.peak_week - cs.debut_date) >= 70 AND cs.total_weeks >= 25 THEN 'Slow Burn'
               WHEN cs.best_rank <= 10 AND cs.total_weeks >= 15                   THEN 'Sustained Hit'
               ELSE 'Other'
           END AS archetype
    FROM chart_stats cs
    JOIN debut_peak dp USING (track_id)
)
SELECT l.archetype,
       COUNT(*) AS track_count,
       ROUND(AVG(t.danceability)::numeric, 3) AS avg_danceability,
       ROUND(AVG(t.energy)::numeric, 3)       AS avg_energy,
       ROUND(AVG(t.valence)::numeric, 3)      AS avg_valence,
       ROUND(AVG(t.acousticness)::numeric, 3) AS avg_acousticness
FROM labeled l
JOIN tracks t ON l.track_id = t.track_id
GROUP BY l.archetype
ORDER BY track_count DESC;
```

### Q9: Decade-adjusted outliers (complex)

For every top-10 hit, computes how many standard deviations each of its core audio features sits from the mean for tracks in the same debut decade. The `decade_stats` CTE aggregates means and stddevs per decade. The main query joins that back to per-track rows, computes the z-scores inline, and filters for any track with at least one feature past 2 standard deviations. Picks out songs that were unusually danceable, energetic, or acoustic for their era.

```sql
WITH track_debut AS (
    SELECT cp.track_id,
           (EXTRACT(YEAR FROM MIN(cp.week_date))::int / 10) * 10 AS decade,
           MIN(cp.peak_rank) AS best_peak
    FROM chart_performance cp
    GROUP BY cp.track_id
),
decade_stats AS (
    SELECT td.decade,
           AVG(t.danceability) AS mean_d, STDDEV(t.danceability) AS sd_d,
           AVG(t.energy)       AS mean_e, STDDEV(t.energy)       AS sd_e,
           AVG(t.acousticness) AS mean_a, STDDEV(t.acousticness) AS sd_a
    FROM track_debut td
    JOIN tracks t USING (track_id)
    GROUP BY td.decade
)
SELECT t.track_name,
       td.decade,
       td.best_peak,
       ROUND(((t.danceability - ds.mean_d) / NULLIF(ds.sd_d, 0))::numeric, 2) AS z_dance,
       ROUND(((t.energy       - ds.mean_e) / NULLIF(ds.sd_e, 0))::numeric, 2) AS z_energy,
       ROUND(((t.acousticness - ds.mean_a) / NULLIF(ds.sd_a, 0))::numeric, 2) AS z_acoustic
FROM track_debut td
JOIN tracks t        USING (track_id)
JOIN decade_stats ds USING (decade)
WHERE td.best_peak <= 10
  AND (ABS((t.danceability - ds.mean_d) / NULLIF(ds.sd_d, 0)) > 2
    OR ABS((t.energy       - ds.mean_e) / NULLIF(ds.sd_e, 0)) > 2
    OR ABS((t.acousticness - ds.mean_a) / NULLIF(ds.sd_a, 0)) > 2)
ORDER BY td.decade, td.best_peak
LIMIT 50;
```

### Q10: Artist pair chemistry (complex)

For every artist pair that collaborated on at least two charting tracks, this query computes the average peak rank of their joint output and compares it to each artist's solo baseline (the average peak rank of tracks where they appear alone). Pairs are ranked by the difference, which we call chemistry uplift. Uses 5 chained CTEs, a self-join on `track_artists`, two `EXISTS` checks in a `HAVING` clause, and a HAVING COUNT filter.

Implementation note: an earlier version of this query used `NOT EXISTS` in a correlated subquery to identify solo tracks. Against the 568k-row `track_artists` table, that form ran for over 5 minutes before we killed it. Rewriting to `GROUP BY ... HAVING COUNT(*) = 1` (via the `track_artist_counts` CTE) drops the runtime to 1.2 seconds with no schema changes.

```sql
WITH charted_tracks AS (
    SELECT track_id, MIN(peak_rank) AS best_peak
    FROM chart_performance
    GROUP BY track_id
),
track_artist_counts AS (
    SELECT track_id, COUNT(*) AS n_artists
    FROM track_artists
    GROUP BY track_id
),
artist_solo AS (
    SELECT ta.artist_id,
           AVG(ct.best_peak) AS solo_avg_peak,
           COUNT(*)          AS solo_hits
    FROM track_artists ta
    JOIN track_artist_counts tac ON ta.track_id = tac.track_id AND tac.n_artists = 1
    JOIN charted_tracks ct       ON ta.track_id = ct.track_id
    GROUP BY ta.artist_id
),
pairs AS (
    SELECT ta1.artist_id AS a1, ta2.artist_id AS a2, ct.best_peak
    FROM track_artists ta1
    JOIN track_artists ta2
      ON ta1.track_id  = ta2.track_id
     AND ta1.artist_id < ta2.artist_id
    JOIN charted_tracks ct ON ta1.track_id = ct.track_id
),
pair_stats AS (
    SELECT a1, a2,
           COUNT(*)       AS joint_hits,
           AVG(best_peak) AS joint_avg_peak
    FROM pairs
    GROUP BY a1, a2
    HAVING COUNT(*) >= 2
       AND EXISTS (SELECT 1 FROM artist_solo WHERE artist_id = a1 AND solo_hits >= 2)
       AND EXISTS (SELECT 1 FROM artist_solo WHERE artist_id = a2 AND solo_hits >= 2)
)
SELECT ar1.artist_name AS artist_1,
       ar2.artist_name AS artist_2,
       ps.joint_hits,
       ROUND(ps.joint_avg_peak::numeric, 2) AS joint_avg_peak,
       ROUND(s1.solo_avg_peak::numeric, 2)  AS artist_1_solo_avg,
       ROUND(s2.solo_avg_peak::numeric, 2)  AS artist_2_solo_avg,
       ROUND((((s1.solo_avg_peak + s2.solo_avg_peak) / 2) - ps.joint_avg_peak)::numeric, 2) AS chemistry_uplift
FROM pair_stats ps
JOIN artists ar1    ON ps.a1 = ar1.artist_id
JOIN artists ar2    ON ps.a2 = ar2.artist_id
JOIN artist_solo s1 ON ps.a1 = s1.artist_id
JOIN artist_solo s2 ON ps.a2 = s2.artist_id
ORDER BY chemistry_uplift DESC
LIMIT 25;
```

## Pre-Optimization Timings

Measured against the RDS instance with only primary key indexes in place. These are our baseline numbers before any of the Milestone 5 optimization work.

| Query | Time |
|---|---|
| Q6 Audio similarity | 17 min 2 s |
| Q7 Workbench filter | 370 ms |
| Q8 Trajectory classification | 1,070 ms |
| Q9 Decade-adjusted outliers | 210 ms |
| Q10 Chemistry leaderboard | 1,210 ms |

Q6 is the obviously slow one at 17 minutes. Q10 also counts as non-trivial because the first version we wrote (with NOT EXISTS) was past 5 minutes before we killed it, which is documented in the Q10 section above.

Things we plan to test in Milestone 5:

- Multi-column index on `tracks(danceability, energy, tempo)` for Q7's filter
- Index on `chart_performance(track_id, week_date)` for Q4 and Q8's window functions
- Materialized view for the `charted_tracks` aggregation used by Q7, Q9, and Q10
- Trigram (`pg_trgm`) index on `tracks(track_name)` for Q1's ILIKE
- `cube` extension plus a GiST index for Q6, which should bring the similarity search from 17 minutes to under a second
