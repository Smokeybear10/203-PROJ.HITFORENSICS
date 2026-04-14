# Hit Forensics — CIS 5500 Final Project

**Team:** Kevin Li, Tommy Ou, Ronnie Wang, Kev Xue

A web application for exploring what makes a song a hit, built on a joined
Spotify + Billboard Hot 100 dataset (1958–2021). The database does the
analytical work; the application is a thin interactive surface over it.

## Prerequisites

- Node 20+
- npm
- Access to the Postgres instance documented in
  [Milestone3.md](Milestone3.md) (guest credentials are shared privately so
  they don't end up on GitHub)

## Running the app locally

```bash
# 1. backend
cd server
cp .env.example .env        # fill in PGUSER / PGPASSWORD
npm install
npm run dev                 # http://localhost:4000

# 2. frontend (in a second terminal)
cd client
cp .env.example .env        # VITE_API_URL defaults to http://localhost:4000
npm install
npm run dev                 # http://localhost:5173
```

Health check: `curl http://localhost:4000/api/health` should return
`{"ok":true}`.

## Running the tests

Both packages use [Vitest](https://vitest.dev/). The server tests use
Supertest against an in-process Express app with the pg pool mocked, so they
never touch the real database. The client tests use React Testing Library
with a mocked `api` module.

```bash
cd server && npm test   # 8 route tests
cd client && npm test   # 5 component tests
```

## Tech stack

See [Milestone2.md §8](Milestone2.md).
