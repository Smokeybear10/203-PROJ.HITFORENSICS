import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export function WorkbenchPage() {
  const [filters, setFilters] = useState({
    danceability_min: 0, danceability_max: 1,
    energy_min: 0, energy_max: 1,
    valence_min: 0, valence_max: 1,
    tempo_min: 60, tempo_max: 200,
  });
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');

  const handleSearch = async () => {
    setStatus('loading');
    try {
      const data = await api.workbench(filters);
      setResults(data);
      setStatus('ok');
    } catch {
      setStatus('error');
    }
  };

  const update = (key, value) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const sliderRow = (name) => (
    <div className="filter-row" key={name}>
      <label>{name}</label>
      <input type="range" min="0" max="1" step="0.05"
        value={filters[`${name}_min`]}
        onChange={(e) => update(`${name}_min`, e.target.value)} />
      <span>{Number(filters[`${name}_min`]).toFixed(2)}</span>
      <span className="dash">–</span>
      <input type="range" min="0" max="1" step="0.05"
        value={filters[`${name}_max`]}
        onChange={(e) => update(`${name}_max`, e.target.value)} />
      <span>{Number(filters[`${name}_max`]).toFixed(2)}</span>
    </div>
  );

  return (
    <section>
      <h1>Audio Feature Workbench</h1>
      <p className="subtle">
        Filter charting tracks by audio features. Results include a per-decade chart-longevity percentile
        computed via NTILE and a global average peak rank comparison.
      </p>

      <div className="card filters">
        {['danceability', 'energy', 'valence'].map(sliderRow)}
        <div className="filter-row">
          <label>Tempo (BPM)</label>
          <input type="number" min="0" max="300"
            value={filters.tempo_min}
            onChange={(e) => update('tempo_min', e.target.value)} />
          <span className="dash">–</span>
          <input type="number" min="0" max="300"
            value={filters.tempo_max}
            onChange={(e) => update('tempo_max', e.target.value)} />
        </div>
        <button onClick={handleSearch} disabled={status === 'loading'}>
          {status === 'loading' ? 'Searching...' : 'Search'}
        </button>
      </div>

      {status === 'error' && <p className="error">Something went wrong.</p>}

      {results.length > 0 && (
        <div className="card">
          <p className="subtle">
            Global avg peak rank: <strong>{results[0]?.global_avg_peak}</strong> &middot;{' '}
            {results.length} results
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Track</th><th>Artist</th><th>Decade</th>
                  <th>Peak</th><th>Weeks</th><th>Decade %ile</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r) => (
                  <tr key={r.track_id}>
                    <td><Link to={`/track/${r.track_id}`}>{r.track_name}</Link></td>
                    <td>{r.artist_name}</td>
                    <td>{r.debut_decade}s</td>
                    <td>#{r.best_peak}</td>
                    <td>{r.total_weeks}</td>
                    <td>{r.decade_longevity_percentile}th</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
}
