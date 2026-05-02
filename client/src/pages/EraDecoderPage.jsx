import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const decades = [1960, 1970, 1980, 1990, 2000, 2010, 2020];

export function EraDecoderPage() {
  const [decade, setDecade] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    setStatus('loading');
    api.getOutliers(decade || null)
      .then((d) => { setResults(d); setStatus('ok'); })
      .catch(() => setStatus('error'));
  }, [decade]);

  const zColor = (z) => {
    const abs = Math.abs(Number(z));
    if (abs > 3) return '#ff6b6b';
    if (abs > 2.5) return '#ffa94d';
    return '#e6e8ec';
  };

  return (
    <section>
      <h1>Era Decoder</h1>
      <p className="subtle">
        Top-10 hits that were outliers for their decade, at least 2 standard deviations
        from the era mean in danceability, energy, or acousticness. These songs were ahead of
        (or maybe behind) their time.
      </p>

      <div className="filter-bar">
        <label>Decade:</label>
        <select value={decade} onChange={(e) => setDecade(e.target.value)}>
          <option value="">All decades</option>
          {decades.map((d) => (
            <option key={d} value={d}>{d}s</option>
          ))}
        </select>
      </div>

      {status === 'loading' && <p>Loading...</p>}
      {status === 'error' && <p className="error">Failed to load data.</p>}

      {status === 'ok' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Track</th><th>Artist</th><th>Decade</th><th>Peak</th>
                <th>z Dance</th><th>z Energy</th><th>z Acoustic</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.track_id}>
                  <td><Link to={`/track/${r.track_id}`}>{r.track_name}</Link></td>
                  <td>{r.artist_name}</td>
                  <td>{r.decade}s</td>
                  <td>#{r.best_peak}</td>
                  <td style={{ color: zColor(r.z_dance) }}>{r.z_dance}</td>
                  <td style={{ color: zColor(r.z_energy) }}>{r.z_energy}</td>
                  <td style={{ color: zColor(r.z_acoustic) }}>{r.z_acoustic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
