const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:4000';

async function request(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

export const api = {
  // Tracks
  searchTracks: (q) => request(`/api/tracks/search?q=${encodeURIComponent(q)}`),
  getTrack: (id) => request(`/api/tracks/${id}`),
  getTrackChart: (id) => request(`/api/tracks/${id}/chart`),
  getSimilarTracks: (id, limit = 10) => request(`/api/tracks/${id}/similar?limit=${limit}`),
  workbench: (params) => {
    const qs = new URLSearchParams(params).toString();
    return request(`/api/tracks/workbench?${qs}`);
  },
  getOutliers: (decade, limit = 50) => {
    const params = new URLSearchParams({ limit });
    if (decade) params.set('decade', decade);
    return request(`/api/tracks/outliers?${params}`);
  },

  // Artists
  searchArtists: (q) => request(`/api/artists/search?q=${encodeURIComponent(q)}`),
  getArtist: (id) => request(`/api/artists/${id}`),
  getChemistry: (limit = 25) => request(`/api/artists/chemistry?limit=${limit}`),

  // Charts
  getTopCharts: (limit = 20) => request(`/api/charts/top?limit=${limit}`),
  getTrajectories: () => request(`/api/charts/trajectories`),
};
