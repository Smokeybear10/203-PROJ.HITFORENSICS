import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';

vi.mock('../db.js', () => ({
  pool: { query: vi.fn() },
}));

const { pool } = await import('../db.js');
const { createApp } = await import('../app.js');
const app = createApp();

beforeEach(() => {
  pool.query.mockReset();
});

describe('GET /api/health', () => {
  it('returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

describe('GET /api/tracks/search', () => {
  it('returns [] and skips the db when q is empty', async () => {
    const res = await request(app).get('/api/tracks/search');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns [] and skips the db when q is only whitespace', async () => {
    const res = await request(app).get('/api/tracks/search?q=%20%20');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('calls the db with the trimmed query and returns its rows', async () => {
    const fakeRows = [
      { track_id: 1, track_name: 'Blinding Lights', popularity: 95 },
      { track_id: 2, track_name: 'Blinding Lights - Remix', popularity: 70 },
    ];
    pool.query.mockResolvedValueOnce({ rows: fakeRows });

    const res = await request(app).get('/api/tracks/search?q=blinding');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(fakeRows);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/FROM tracks/i);
    expect(sql).toMatch(/ILIKE/i);
    expect(sql).toMatch(/LIMIT 20/i);
    expect(params).toEqual(['blinding']);
  });

  it('returns 500 when the db throws', async () => {
    pool.query.mockRejectedValueOnce(new Error('boom'));
    const res = await request(app).get('/api/tracks/search?q=x');
    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'internal error' });
  });
});

describe('GET /api/tracks/:id', () => {
  it('rejects non-integer ids with 400', async () => {
    const res = await request(app).get('/api/tracks/abc');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'track id must be an integer' });
    expect(pool.query).not.toHaveBeenCalled();
  });

  it('returns 404 when the track does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });
    const res = await request(app).get('/api/tracks/9999');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'not found' });
  });

  it('returns the track row when found', async () => {
    const row = {
      track_id: 42,
      track_name: 'Shape of You',
      artist_name: 'Ed Sheeran',
      danceability: 0.825,
      energy: 0.652,
    };
    pool.query.mockResolvedValueOnce({ rows: [row] });

    const res = await request(app).get('/api/tracks/42');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(row);
    expect(pool.query).toHaveBeenCalledTimes(1);
    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toMatch(/JOIN track_artists/i);
    expect(sql).toMatch(/is_primary = TRUE/i);
    expect(params).toEqual([42]);
  });
});
