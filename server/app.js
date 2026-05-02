import express from 'express';
import cors from 'cors';
import { tracksRouter } from './routes/tracks.js';
import { artistsRouter } from './routes/artists.js';
import { chartsRouter } from './routes/charts.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/tracks', tracksRouter);
  app.use('/api/artists', artistsRouter);
  app.use('/api/charts', chartsRouter);

  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });

  return app;
}
