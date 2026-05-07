# Hit Forensics — agent guide

## Design System
Always read `DESIGN.md` before making any visual or UI decisions. All font choices,
colors, spacing, components, and aesthetic direction are defined there. Do not
deviate without explicit user approval. Flag any code that doesn't match
`DESIGN.md` during review.

## Stack
- **Database:** PostgreSQL 17 on AWS RDS. Extensions: `pg_trgm`, `cube`. Run `db/optimization.sql` once before first server start.
- **Server:** `server/` — Express 4 + `pg` pool, ES modules. Three route files: `tracks.js`, `artists.js`, `charts.js`. Tests use Vitest + Supertest with the pool mocked.
- **Client:** `client/` — React 18 + Vite 5 + React Router 6 + Recharts. Pages live in `client/src/pages/`. API calls go through `client/src/api.js`.

## Brand
- Product name: **Hit Forensics**.
- Wordmark: `Hit` in a mustard pill blob, `Forensics` in Fraunces italic immediately after, trailing magenta period. Defined in `client/src/main.jsx` and styled in `client/src/styles.css`.

## Conventions
- Page heroes follow the kicker → headline → lede pattern. Kicker is a mono small-caps chip referencing the backing query (e.g. `File Q1 · fuzzy match`). See `DESIGN.md → Components → Page hero`.
- Data pages render the hero unconditionally; loading/error states swap only the data section, not the page chrome. (Bug pattern fixed 2026-05-07 across Trajectory, Chemistry, Top Charts.)
- Recharts theming is global: stroke `rgba(14,30,63,0.18)`, axis text in mono, primary series in magenta `#FF2E63`. Don't pass per-chart color overrides without DESIGN.md approval.

## Don't
- Re-introduce Caveat or any handwritten font.
- Add purple/violet gradients or decorative blobs.
- Use generic centered three-column SaaS feature grids.
- Touch the `package.json` `"name"` fields (`hit-forensics-client`, `hit-forensics-server`) without coordinating — they're npm package identifiers, separate from the brand name.
