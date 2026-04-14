import { Router } from 'express';
import { pool } from '../db.js';

export const tracksRouter = Router();

// Q1: fuzzy song search by partial name, sorted by popularity
tracksRouter.get('/search', async (req, res, next) => {
  try {
    const q = (req.query.q ?? '').toString().trim();
    if (!q) return res.json([]);
    const { rows } = await pool.query(
      `SELECT track_id, track_name, popularity
         FROM tracks
        WHERE track_name ILIKE '%' || $1 || '%'
        ORDER BY popularity DESC NULLS LAST
        LIMIT 20`,
      [q]
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
      `SELECT t.track_id, t.track_name, a.artist_name,
              t.danceability, t.energy, t.valence, t.acousticness,
              t.instrumentalness, t.speechiness, t.liveness,
              t.tempo, t.loudness, t.key, t.mode, t.time_signature,
              t.explicit, t.popularity
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
