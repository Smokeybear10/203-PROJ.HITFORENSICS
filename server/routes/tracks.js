import { Router } from 'express';
import { pool } from '../db.js';

export const tracksRouter = Router();

// Q1: fuzzy song search by partial name, sorted by popularity
tracksRouter.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q ?? '').toString().trim();
    if (!q) return res.json([]);
    const { rows } = await pool.query(
      `SELECT t.track_id, t.track_name, a.artist_name, t.popularity
         FROM tracks t
         JOIN track_artists ta ON t.track_id = ta.track_id AND ta.is_primary = TRUE
         JOIN artists a ON ta.artist_id = a.artist_id
        WHERE t.track_name ILIKE '%' || $1 || '%'
        ORDER BY t.popularity DESC NULLS LAST
        LIMIT 20`,
      [q]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Q7: multi-feature filter with per-decade percentile ranking
tracksRouter.get('/workbench', async (req, res, next) => {
  try {
    const danceMin = Number(req.query.danceability_min) || 0;
    const danceMax = Number(req.query.danceability_max) || 1;
    const energyMin = Number(req.query.energy_min) || 0;
    const energyMax = Number(req.query.energy_max) || 1;
    const valenceMin = Number(req.query.valence_min) || 0;
    const valenceMax = Number(req.query.valence_max) || 1;
    const tempoMin = Number(req.query.tempo_min) || 0;
    const tempoMax = Number(req.query.tempo_max) || 300;
    const lim = Math.min(Number(req.query.limit) || 50, 200);

    const { rows } = await pool.query(
      `WITH track_debut AS (
          SELECT cp.track_id,
                 (EXTRACT(YEAR FROM MIN(cp.week_date))::int / 10) * 10 AS debut_decade,
                 MIN(cp.peak_rank)      AS best_peak,
                 MAX(cp.weeks_on_chart) AS total_weeks
            FROM chart_performance cp
           GROUP BY cp.track_id
       )
       SELECT t.track_id, t.track_name, a.artist_name,
              t.danceability, t.energy, t.valence, t.tempo,
              d.debut_decade, d.best_peak, d.total_weeks,
              NTILE(100) OVER (PARTITION BY d.debut_decade ORDER BY d.total_weeks)
                  AS decade_longevity_percentile,
              (SELECT ROUND(AVG(best_peak)::numeric, 2) FROM track_debut) AS global_avg_peak
         FROM tracks t
         JOIN track_debut d ON t.track_id = d.track_id
         JOIN track_artists ta ON t.track_id = ta.track_id AND ta.is_primary = TRUE
         JOIN artists a ON ta.artist_id = a.artist_id
        WHERE t.danceability BETWEEN $1 AND $2
          AND t.energy       BETWEEN $3 AND $4
          AND t.valence      BETWEEN $5 AND $6
          AND t.tempo        BETWEEN $7 AND $8
        ORDER BY d.best_peak ASC
        LIMIT $9`,
      [danceMin, danceMax, energyMin, energyMax,
       valenceMin, valenceMax, tempoMin, tempoMax, lim]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Q9: decade-adjusted outliers (era decoder)
tracksRouter.get('/outliers', async (req, res, next) => {
  try {
    const decade = req.query.decade ? Number(req.query.decade) : null;
    const lim = Math.min(Number(req.query.limit) || 50, 200);

    const { rows } = await pool.query(
      `WITH track_debut AS (
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
       SELECT t.track_id, t.track_name, a.artist_name,
              td.decade, td.best_peak,
              ROUND(((t.danceability - ds.mean_d) / NULLIF(ds.sd_d, 0))::numeric, 2) AS z_dance,
              ROUND(((t.energy       - ds.mean_e) / NULLIF(ds.sd_e, 0))::numeric, 2) AS z_energy,
              ROUND(((t.acousticness - ds.mean_a) / NULLIF(ds.sd_a, 0))::numeric, 2) AS z_acoustic
         FROM track_debut td
         JOIN tracks t        USING (track_id)
         JOIN decade_stats ds USING (decade)
         JOIN track_artists ta ON t.track_id = ta.track_id AND ta.is_primary = TRUE
         JOIN artists a ON ta.artist_id = a.artist_id
        WHERE td.best_peak <= 10
          AND ($1::int IS NULL OR td.decade = $1)
          AND (ABS((t.danceability - ds.mean_d) / NULLIF(ds.sd_d, 0)) > 2
            OR ABS((t.energy       - ds.mean_e) / NULLIF(ds.sd_e, 0)) > 2
            OR ABS((t.acousticness - ds.mean_a) / NULLIF(ds.sd_a, 0)) > 2)
        ORDER BY td.decade, td.best_peak
        LIMIT $2`,
      [decade, lim]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Q2: full audio fingerprint for a track plus its primary artist
tracksRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'track id must be an integer' });
    }
    const { rows } = await pool.query(
      `SELECT t.track_id, t.track_name, a.artist_id, a.artist_name,
              t.danceability, t.energy, t.valence, t.acousticness,
              t.instrumentalness, t.speechiness, t.liveness,
              t.tempo, t.loudness, t.key, t.mode, t.time_signature,
              t.duration_ms, t.explicit, t.popularity
         FROM tracks t
         JOIN track_artists ta ON t.track_id = ta.track_id AND ta.is_primary = TRUE
         JOIN artists a        ON ta.artist_id = a.artist_id
        WHERE t.track_id = $1`,
      [id]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// Q4: chart trajectory for a track
tracksRouter.get('/:id/chart', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'track id must be an integer' });
    }
    const { rows } = await pool.query(
      `SELECT week_date, current_rank, peak_rank, weeks_on_chart
         FROM chart_performance
        WHERE track_id = $1
        ORDER BY week_date`,
      [id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Q6: audio similarity / twin finder for a given track
tracksRouter.get('/:id/similar', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'track id must be an integer' });
    }
    const lim = Math.min(Number(req.query.limit) || 10, 50);

    const { rows } = await pool.query(
      `WITH ref AS (
          SELECT danceability, energy, valence, acousticness, instrumentalness
            FROM tracks WHERE track_id = $1
       )
       SELECT t.track_id, t.track_name, a.artist_name, t.popularity,
              t.danceability, t.energy, t.valence, t.acousticness, t.instrumentalness,
              ROUND(SQRT(
                POWER(ref.danceability     - t.danceability, 2) +
                POWER(ref.energy           - t.energy, 2) +
                POWER(ref.valence          - t.valence, 2) +
                POWER(ref.acousticness     - t.acousticness, 2) +
                POWER(ref.instrumentalness - t.instrumentalness, 2)
              )::numeric, 4) AS audio_distance
         FROM ref
         CROSS JOIN tracks t
         JOIN track_artists ta ON t.track_id = ta.track_id AND ta.is_primary = TRUE
         JOIN artists a ON ta.artist_id = a.artist_id
        WHERE t.track_id <> $1
        ORDER BY audio_distance ASC
        LIMIT $2`,
      [id, lim]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
