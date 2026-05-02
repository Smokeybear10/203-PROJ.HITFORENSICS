import { Router } from 'express';
import { pool } from '../db.js';

export const chartsRouter = Router();

// Q5: top songs by cumulative weeks on the Hot 100
chartsRouter.get('/top', async (req, res, next) => {
  try {
    const lim = Math.min(Number(req.query.limit) || 20, 100);
    const { rows } = await pool.query(
      `SELECT t.track_id, t.track_name, a.artist_name,
              MAX(cp.weeks_on_chart) AS total_weeks,
              MIN(cp.peak_rank)      AS best_peak
         FROM tracks t
         JOIN chart_performance cp ON t.track_id = cp.track_id
         JOIN track_artists ta ON t.track_id = ta.track_id AND ta.is_primary = TRUE
         JOIN artists a ON ta.artist_id = a.artist_id
        GROUP BY t.track_id, t.track_name, a.artist_name
        ORDER BY total_weeks DESC
        LIMIT $1`,
      [lim]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Q8: chart trajectory classification into five archetypes
chartsRouter.get('/trajectories', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `WITH chart_stats AS (
          SELECT track_id,
                 MIN(week_date)      AS debut_date,
                 MIN(current_rank)   AS best_rank,
                 MAX(weeks_on_chart) AS total_weeks
            FROM chart_performance
           GROUP BY track_id
       ),
       debut_peak AS (
          SELECT DISTINCT track_id,
                 FIRST_VALUE(current_rank) OVER (PARTITION BY track_id ORDER BY week_date)                        AS debut_rank,
                 FIRST_VALUE(week_date)    OVER (PARTITION BY track_id ORDER BY current_rank ASC, week_date ASC)  AS peak_week
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
              ROUND(AVG(t.acousticness)::numeric, 3) AS avg_acousticness,
              ROUND(AVG(t.tempo)::numeric, 1)        AS avg_tempo,
              ROUND(AVG(t.loudness)::numeric, 1)     AS avg_loudness
         FROM labeled l
         JOIN tracks t ON l.track_id = t.track_id
        GROUP BY l.archetype
        ORDER BY track_count DESC`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
