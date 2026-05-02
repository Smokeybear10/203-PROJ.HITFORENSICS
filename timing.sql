-- =============================================================================
-- Hit Forensics: Query Timing Benchmarks
-- Run these BEFORE and AFTER running optimization.sql to measure improvement.
-- Use: psql -h <host> -U <user> -d music_db -f timing.sql
-- Or run individual queries with \timing in psql.
-- =============================================================================

\timing on

-- ===================== Q6: Audio Similarity (per-track) ======================
-- Pre-optimization: brute-force Euclidean distance (~3-10s per track)
-- Post-optimization: cube <-> with GiST index (<100ms)

-- PRE-OPTIMIZATION version (run before optimization.sql):
EXPLAIN ANALYZE
WITH ref AS (
    SELECT danceability, energy, valence, acousticness, instrumentalness
      FROM tracks WHERE track_id = 7
)
SELECT t.track_id, t.track_name,
       ROUND(SQRT(
         POWER(ref.danceability     - t.danceability, 2) +
         POWER(ref.energy           - t.energy, 2) +
         POWER(ref.valence          - t.valence, 2) +
         POWER(ref.acousticness     - t.acousticness, 2) +
         POWER(ref.instrumentalness - t.instrumentalness, 2)
       )::numeric, 4) AS audio_distance
  FROM ref
  CROSS JOIN tracks t
 WHERE t.track_id <> 7
 ORDER BY audio_distance ASC
 LIMIT 10;

-- POST-OPTIMIZATION version (run after optimization.sql):
EXPLAIN ANALYZE
SELECT t.track_id, t.track_name,
       ROUND((t.audio_cube <-> (SELECT audio_cube FROM tracks WHERE track_id = 7))::numeric, 4)
           AS audio_distance
  FROM tracks t
 WHERE t.track_id <> 7
   AND t.audio_cube IS NOT NULL
 ORDER BY t.audio_cube <-> (SELECT audio_cube FROM tracks WHERE track_id = 7)
 LIMIT 10;

-- ===================== Q7: Workbench Filter ==================================
-- Pre-optimization: inline CTE aggregates 247k chart_performance rows (~370ms)
-- Post-optimization: mv_charted_tracks + B-tree index on features (<50ms)

-- PRE-OPTIMIZATION version:
EXPLAIN ANALYZE
WITH track_debut AS (
    SELECT cp.track_id,
           (EXTRACT(YEAR FROM MIN(cp.week_date))::int / 10) * 10 AS debut_decade,
           MIN(cp.peak_rank)      AS best_peak,
           MAX(cp.weeks_on_chart) AS total_weeks
      FROM chart_performance cp
     GROUP BY cp.track_id
)
SELECT t.track_name, t.danceability, t.energy, t.valence, t.tempo,
       d.debut_decade, d.best_peak, d.total_weeks,
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

-- POST-OPTIMIZATION version:
EXPLAIN ANALYZE
SELECT t.track_name, t.danceability, t.energy, t.valence, t.tempo,
       d.debut_decade, d.best_peak, d.total_weeks,
       NTILE(100) OVER (PARTITION BY d.debut_decade ORDER BY d.total_weeks)
           AS decade_longevity_percentile,
       (SELECT ROUND(AVG(best_peak)::numeric, 2) FROM mv_charted_tracks) AS global_avg_peak
  FROM tracks t
  JOIN mv_charted_tracks d ON t.track_id = d.track_id
 WHERE t.danceability > 0.70
   AND t.energy BETWEEN 0.50 AND 0.90
   AND t.tempo  BETWEEN 110  AND 130
 ORDER BY d.best_peak ASC
 LIMIT 100;

-- ===================== Q8: Trajectory Classification =========================
-- Pre-optimization: window functions over full chart_performance (~1,070ms)
-- Post-optimization: index on chart_performance(track_id, week_date) (<400ms)

EXPLAIN ANALYZE
WITH chart_stats AS (
    SELECT track_id,
           MIN(week_date)      AS debut_date,
           MIN(current_rank)   AS best_rank,
           MAX(weeks_on_chart) AS total_weeks
      FROM chart_performance
     GROUP BY track_id
),
debut_peak AS (
    SELECT DISTINCT track_id,
           FIRST_VALUE(current_rank) OVER (PARTITION BY track_id ORDER BY week_date)                       AS debut_rank,
           FIRST_VALUE(week_date)    OVER (PARTITION BY track_id ORDER BY current_rank ASC, week_date ASC) AS peak_week
      FROM chart_performance
),
labeled AS (
    SELECT cs.track_id,
           CASE
               WHEN cs.total_weeks <= 10 AND (dp.peak_week - cs.debut_date) <= 21            THEN 'Flash'
               WHEN dp.debut_rank > 50  AND (dp.peak_week - cs.debut_date) >= 140            THEN 'Sleeper'
               WHEN (dp.peak_week - cs.debut_date) >= 70 AND cs.total_weeks >= 25            THEN 'Slow Burn'
               WHEN cs.best_rank <= 10 AND cs.total_weeks >= 15                              THEN 'Sustained Hit'
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

-- ===================== Q9: Decade-Adjusted Outliers ==========================
-- Pre-optimization: inline CTE (~210ms)
-- Post-optimization: mv_charted_tracks + index on best_peak (<50ms)

-- PRE-OPTIMIZATION version:
EXPLAIN ANALYZE
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
SELECT t.track_name, td.decade, td.best_peak,
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

-- POST-OPTIMIZATION version:
EXPLAIN ANALYZE
WITH decade_stats AS (
    SELECT d.debut_decade AS decade,
           AVG(t.danceability) AS mean_d, STDDEV(t.danceability) AS sd_d,
           AVG(t.energy)       AS mean_e, STDDEV(t.energy)       AS sd_e,
           AVG(t.acousticness) AS mean_a, STDDEV(t.acousticness) AS sd_a
      FROM mv_charted_tracks d
      JOIN tracks t USING (track_id)
     GROUP BY d.debut_decade
)
SELECT t.track_name, d.debut_decade AS decade, d.best_peak,
       ROUND(((t.danceability - ds.mean_d) / NULLIF(ds.sd_d, 0))::numeric, 2) AS z_dance,
       ROUND(((t.energy       - ds.mean_e) / NULLIF(ds.sd_e, 0))::numeric, 2) AS z_energy,
       ROUND(((t.acousticness - ds.mean_a) / NULLIF(ds.sd_a, 0))::numeric, 2) AS z_acoustic
  FROM mv_charted_tracks d
  JOIN tracks t        USING (track_id)
  JOIN decade_stats ds ON d.debut_decade = ds.decade
 WHERE d.best_peak <= 10
   AND (ABS((t.danceability - ds.mean_d) / NULLIF(ds.sd_d, 0)) > 2
     OR ABS((t.energy       - ds.mean_e) / NULLIF(ds.sd_e, 0)) > 2
     OR ABS((t.acousticness - ds.mean_a) / NULLIF(ds.sd_a, 0)) > 2)
 ORDER BY d.debut_decade, d.best_peak
 LIMIT 50;

-- ===================== Q10: Chemistry Leaderboard ============================
-- Pre-optimization: inline charted_tracks CTE (~1,210ms)
-- Post-optimization: mv_charted_tracks + junction indexes (<400ms)

-- PRE-OPTIMIZATION version:
EXPLAIN ANALYZE
WITH charted_tracks AS (
    SELECT track_id, MIN(peak_rank) AS best_peak
      FROM chart_performance GROUP BY track_id
),
track_artist_counts AS (
    SELECT track_id, COUNT(*) AS n_artists
      FROM track_artists GROUP BY track_id
),
artist_solo AS (
    SELECT ta.artist_id, AVG(ct.best_peak) AS solo_avg_peak, COUNT(*) AS solo_hits
      FROM track_artists ta
      JOIN track_artist_counts tac ON ta.track_id = tac.track_id AND tac.n_artists = 1
      JOIN charted_tracks ct       ON ta.track_id = ct.track_id
     GROUP BY ta.artist_id
),
pairs AS (
    SELECT ta1.artist_id AS a1, ta2.artist_id AS a2, ct.best_peak
      FROM track_artists ta1
      JOIN track_artists ta2 ON ta1.track_id = ta2.track_id AND ta1.artist_id < ta2.artist_id
      JOIN charted_tracks ct ON ta1.track_id = ct.track_id
),
pair_stats AS (
    SELECT a1, a2, COUNT(*) AS joint_hits, AVG(best_peak) AS joint_avg_peak
      FROM pairs GROUP BY a1, a2
    HAVING COUNT(*) >= 2
       AND EXISTS (SELECT 1 FROM artist_solo WHERE artist_id = a1 AND solo_hits >= 2)
       AND EXISTS (SELECT 1 FROM artist_solo WHERE artist_id = a2 AND solo_hits >= 2)
)
SELECT ar1.artist_name, ar2.artist_name, ps.joint_hits,
       ROUND(ps.joint_avg_peak::numeric,2), ROUND(s1.solo_avg_peak::numeric,2),
       ROUND(s2.solo_avg_peak::numeric,2),
       ROUND((((s1.solo_avg_peak+s2.solo_avg_peak)/2)-ps.joint_avg_peak)::numeric,2) AS uplift
  FROM pair_stats ps
  JOIN artists ar1 ON ps.a1=ar1.artist_id JOIN artists ar2 ON ps.a2=ar2.artist_id
  JOIN artist_solo s1 ON ps.a1=s1.artist_id JOIN artist_solo s2 ON ps.a2=s2.artist_id
 ORDER BY uplift DESC LIMIT 25;

-- POST-OPTIMIZATION version:
EXPLAIN ANALYZE
WITH track_artist_counts AS (
    SELECT track_id, COUNT(*) AS n_artists
      FROM track_artists GROUP BY track_id
),
artist_solo AS (
    SELECT ta.artist_id, AVG(ct.best_peak) AS solo_avg_peak, COUNT(*) AS solo_hits
      FROM track_artists ta
      JOIN track_artist_counts tac ON ta.track_id = tac.track_id AND tac.n_artists = 1
      JOIN mv_charted_tracks ct    ON ta.track_id = ct.track_id
     GROUP BY ta.artist_id
),
pairs AS (
    SELECT ta1.artist_id AS a1, ta2.artist_id AS a2, ct.best_peak
      FROM track_artists ta1
      JOIN track_artists ta2 ON ta1.track_id = ta2.track_id AND ta1.artist_id < ta2.artist_id
      JOIN mv_charted_tracks ct ON ta1.track_id = ct.track_id
),
pair_stats AS (
    SELECT a1, a2, COUNT(*) AS joint_hits, AVG(best_peak) AS joint_avg_peak
      FROM pairs GROUP BY a1, a2
    HAVING COUNT(*) >= 2
       AND EXISTS (SELECT 1 FROM artist_solo WHERE artist_id = a1 AND solo_hits >= 2)
       AND EXISTS (SELECT 1 FROM artist_solo WHERE artist_id = a2 AND solo_hits >= 2)
)
SELECT ar1.artist_name, ar2.artist_name, ps.joint_hits,
       ROUND(ps.joint_avg_peak::numeric,2), ROUND(s1.solo_avg_peak::numeric,2),
       ROUND(s2.solo_avg_peak::numeric,2),
       ROUND((((s1.solo_avg_peak+s2.solo_avg_peak)/2)-ps.joint_avg_peak)::numeric,2) AS uplift
  FROM pair_stats ps
  JOIN artists ar1 ON ps.a1=ar1.artist_id JOIN artists ar2 ON ps.a2=ar2.artist_id
  JOIN artist_solo s1 ON ps.a1=s1.artist_id JOIN artist_solo s2 ON ps.a2=s2.artist_id
 ORDER BY uplift DESC LIMIT 25;

-- ===================== Q1: Fuzzy Search ======================================
-- Pre-optimization: sequential scan with ILIKE
-- Post-optimization: GIN trigram index

EXPLAIN ANALYZE
SELECT track_id, track_name, popularity
  FROM tracks
 WHERE track_name ILIKE '%blinding lights%'
 ORDER BY popularity DESC
 LIMIT 20;
