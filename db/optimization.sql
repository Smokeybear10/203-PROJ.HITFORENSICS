-- =============================================================================
-- Hit Forensics: Query Optimization DDL
-- Run this against the music_db database on RDS after populating data.
-- Each section can be run independently.
-- =============================================================================

-- ===================== 1. Extensions =========================================

CREATE EXTENSION IF NOT EXISTS pg_trgm;   -- trigram similarity for fuzzy ILIKE
CREATE EXTENSION IF NOT EXISTS cube;      -- multi-dimensional distance operator

-- ===================== 2. B-tree Indexes =====================================

-- Chart performance: covers GROUP BY track_id and range scans by week_date
-- Benefits: Q4 (chart trajectory), Q7/Q8/Q9/Q10 (CTE aggregations)
CREATE INDEX IF NOT EXISTS idx_chart_perf_track_week
    ON chart_performance (track_id, week_date);

CREATE INDEX IF NOT EXISTS idx_chart_perf_track_peak
    ON chart_performance (track_id, peak_rank);

CREATE INDEX IF NOT EXISTS idx_chart_perf_week
    ON chart_performance (week_date);

-- Tracks: multi-column index for Workbench range filters (Q7)
CREATE INDEX IF NOT EXISTS idx_tracks_features
    ON tracks (danceability, energy, valence, tempo);

-- Junction traversal: look up tracks by artist (Q3, Q10)
CREATE INDEX IF NOT EXISTS idx_track_artists_artist
    ON track_artists (artist_id);

-- Partial index: quickly find primary artist for any track (used in every route)
CREATE INDEX IF NOT EXISTS idx_track_artists_primary
    ON track_artists (track_id) WHERE is_primary = TRUE;

-- ===================== 3. GIN Trigram Indexes =================================
-- Dramatically speeds up ILIKE '%...%' patterns in Q1 and artist search

CREATE INDEX IF NOT EXISTS idx_tracks_name_trgm
    ON tracks USING GIN (track_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_artists_name_trgm
    ON artists USING GIN (artist_name gin_trgm_ops);

-- ===================== 4. Materialized View ==================================
-- Pre-aggregates chart_performance per track. Replaces the inline CTE that
-- appears in Q7, Q9, and Q10 — avoids re-scanning 247k rows on every request.
-- Refresh after any bulk data load: REFRESH MATERIALIZED VIEW CONCURRENTLY mv_charted_tracks;

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_charted_tracks AS
SELECT cp.track_id,
       MIN(cp.peak_rank)                                          AS best_peak,
       MAX(cp.weeks_on_chart)                                     AS total_weeks,
       MIN(cp.week_date)                                          AS debut_date,
       (EXTRACT(YEAR FROM MIN(cp.week_date))::int / 10) * 10     AS debut_decade
  FROM chart_performance cp
 GROUP BY cp.track_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_charted_pk
    ON mv_charted_tracks (track_id);

CREATE INDEX IF NOT EXISTS idx_mv_charted_decade
    ON mv_charted_tracks (debut_decade);

CREATE INDEX IF NOT EXISTS idx_mv_charted_peak
    ON mv_charted_tracks (best_peak);

-- ===================== 5. Cube Column + GiST Index ===========================
-- Adds a precomputed 5-dimensional cube to each track for nearest-neighbor
-- search via the <-> operator. GiST index enables sub-second k-NN lookups
-- across 447k tracks (down from 17+ minutes with brute-force cross join).

ALTER TABLE tracks ADD COLUMN IF NOT EXISTS audio_cube cube;

UPDATE tracks
   SET audio_cube = cube(ARRAY[
           danceability::double precision,
           energy::double precision,
           valence::double precision,
           acousticness::double precision,
           instrumentalness::double precision
       ]);

CREATE INDEX IF NOT EXISTS idx_tracks_audio_cube
    ON tracks USING GIST (audio_cube);

-- ===================== 6. Verify =============================================

-- Quick sanity checks
SELECT 'mv_charted_tracks' AS object, COUNT(*) AS rows FROM mv_charted_tracks
UNION ALL
SELECT 'tracks with audio_cube', COUNT(*) FROM tracks WHERE audio_cube IS NOT NULL;
