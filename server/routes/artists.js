import { Router } from 'express';
import { pool } from '../db.js';

export const artistsRouter = Router();

// Search artists by name
artistsRouter.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q ?? '').toString().trim();
    if (!q) return res.json([]);
    const { rows } = await pool.query(
      `SELECT artist_id, artist_name, popularity, followers
         FROM artists
        WHERE artist_name ILIKE '%' || $1 || '%'
        ORDER BY popularity DESC NULLS LAST
        LIMIT 20`,
      [q]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Q10: collab chemistry leaderboard
artistsRouter.get('/chemistry', async (req, res, next) => {
  try {
    const lim = Math.min(Number(req.query.limit) || 25, 100);
    // Optimized: uses mv_charted_tracks instead of inline charted_tracks CTE
    const { rows } = await pool.query(
      `WITH track_artist_counts AS (
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
            JOIN mv_charted_tracks ct    ON ta.track_id = ct.track_id
           GROUP BY ta.artist_id
       ),
       pairs AS (
          SELECT ta1.artist_id AS a1, ta2.artist_id AS a2, ct.best_peak
            FROM track_artists ta1
            JOIN track_artists ta2
              ON ta1.track_id  = ta2.track_id
             AND ta1.artist_id < ta2.artist_id
            JOIN mv_charted_tracks ct ON ta1.track_id = ct.track_id
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
              ROUND((((s1.solo_avg_peak + s2.solo_avg_peak) / 2) - ps.joint_avg_peak)::numeric, 2)
                  AS chemistry_uplift
         FROM pair_stats ps
         JOIN artists ar1    ON ps.a1 = ar1.artist_id
         JOIN artists ar2    ON ps.a2 = ar2.artist_id
         JOIN artist_solo s1 ON ps.a1 = s1.artist_id
         JOIN artist_solo s2 ON ps.a2 = s2.artist_id
        ORDER BY chemistry_uplift DESC
        LIMIT $1`,
      [lim]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// Q3: artist detail with discography and chart stats
artistsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ error: 'artist id must be an integer' });
    }

    const artistResult = await pool.query(
      `SELECT artist_id, artist_name, followers, popularity, genres
         FROM artists WHERE artist_id = $1`,
      [id]
    );
    if (artistResult.rows.length === 0) {
      return res.status(404).json({ error: 'artist not found' });
    }

    const tracksResult = await pool.query(
      `SELECT t.track_id, t.track_name, t.popularity,
              MIN(cp.peak_rank)      AS best_peak_rank,
              MAX(cp.weeks_on_chart) AS total_weeks_on_chart
         FROM track_artists ta
         JOIN tracks t ON ta.track_id = t.track_id
         LEFT JOIN chart_performance cp ON t.track_id = cp.track_id
        WHERE ta.artist_id = $1
        GROUP BY t.track_id, t.track_name, t.popularity
        ORDER BY t.popularity DESC
        LIMIT 50`,
      [id]
    );

    res.json({
      ...artistResult.rows[0],
      tracks: tracksResult.rows,
    });
  } catch (err) {
    next(err);
  }
});
