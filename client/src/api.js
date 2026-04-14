const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function request(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  searchTracks: (q) => request(`/api/tracks/search?q=${encodeURIComponent(q)}`),
  getTrack: (id) => request(`/api/tracks/${id}`),
};
