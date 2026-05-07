-- CIS 5500 Milestone 3 queries
-- Database: music_db
-- 10 queries, Q1-Q5 simple, Q6-Q10 complex

-- Q1: fuzzy song search by partial name, sorted by popularity
SELECT track_id, track_name, popularity
FROM tracks
WHERE track_name ILIKE '%blinding lights%'
ORDER BY popularity DESC
LIMIT 20;

-- Q2: full audio fingerprint for a track plus its primary artist
SELECT t.track_id, t.track_name, a.artist_name,
       t.danceability, t.energy, t.valence, t.acousticness,
       t.instrumentalness, t.speechiness, t.liveness,
       t.tempo, t.loudness, t.key, t.mode, t.time_signature,
       t.explicit, t.popularity
FROM tracks t
JOIN track_artists ta ON t.track_id = ta.track_id AND ta.is_primary = TRUE
JOIN artists a ON ta.artist_id = a.artist_id
WHERE t.track_id = 1;

-- Q3: an artist's tracks with best peak rank and total weeks charted
SELECT t.track_name,
       t.popularity,
       MIN(cp.peak_rank)      AS best_peak_rank,
       MAX(cp.weeks_on_chart) AS total_weeks_on_chart
FROM artists a
JOIN track_artists ta ON a.artist_id = ta.artist_id
JOIN tracks t          ON ta.track_id = t.track_id
LEFT JOIN chart_performance cp ON t.track_id = cp.track_id
WHERE a.artist_name = 'Drake'
GROUP BY t.track_id, t.track_name, t.popularity
ORDER BY t.popularity DESC
LIMIT 50;

-- Q4: weekly chart history for a track
SELECT week_date, current_rank, peak_rank, weeks_on_chart
FROM chart_performance
WHERE track_id = (
    SELECT track_id FROM tracks WHERE track_name ILIKE 'shape of you' LIMIT 1
)
ORDER BY week_date;

-- Q5: top 20 songs by cumulative weeks on the Hot 100
SELECT t.track_name,
       MAX(cp.weeks_on_chart) AS total_weeks,
       MIN(cp.peak_rank)      AS best_peak
FROM tracks t
JOIN chart_performance cp ON t.track_id = cp.track_id
GROUP BY t.track_id, t.track_name
ORDER BY total_weeks DESC
LIMIT 20;

-- Q6: audio similarity search for every #1 hit. cross join against the full
-- tracks table with a 5-dimensional Euclidean distance filter. takes about 17
-- minutes without any index. will be optimized in Milestone 5 with the cube
-- extension and a GiST index.
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

-- Q7: filter tracks by audio feature ranges, rank each result by how long it
-- stayed on the chart relative to other tracks from the same decade (NTILE
-- window function), and compare the filtered set's average peak rank to the
-- global average via a scalar subquery.
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

-- Q8: classify every charted track into one of five trajectory shapes (Flash,
-- Sleeper, Slow Burn, Sustained Hit, Other) using FIRST_VALUE window functions
-- over chart_performance, then report the average audio profile per bucket.
WITH chart_stats AS (
    SELECT track_id,
           MIN(week_date)                                    AS debut_date,
           MIN(current_rank)                                 AS best_rank,
           MAX(weeks_on_chart)                               AS total_weeks
    FROM chart_performance
    GROUP BY track_id
),
debut_peak AS (
    SELECT DISTINCT track_id,
           FIRST_VALUE(current_rank) OVER (PARTITION BY track_id ORDER BY week_date)      AS debut_rank,
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

-- Q9: for every top-10 hit, compute how many standard deviations each of its
-- audio features sits from the mean for tracks in the same decade. picks out
-- songs that were unusual for their era.
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
JOIN tracks t       USING (track_id)
JOIN decade_stats ds USING (decade)
WHERE td.best_peak <= 10
  AND (ABS((t.danceability - ds.mean_d) / NULLIF(ds.sd_d, 0)) > 2
    OR ABS((t.energy       - ds.mean_e) / NULLIF(ds.sd_e, 0)) > 2
    OR ABS((t.acousticness - ds.mean_a) / NULLIF(ds.sd_a, 0)) > 2)
ORDER BY td.decade, td.best_peak
LIMIT 50;

-- Q10: artist pair chemistry. for every pair of artists that collaborated on
-- 2+ charting tracks, compute the average peak rank of their joint work and
-- compare to each artist's solo baseline. rank by the uplift.
-- note: the first version used NOT EXISTS to find solo tracks and ran past 5
-- minutes before we killed it. the GROUP BY HAVING COUNT=1 pattern below
-- (track_artist_counts CTE) brings it down to 1.2 seconds.
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
