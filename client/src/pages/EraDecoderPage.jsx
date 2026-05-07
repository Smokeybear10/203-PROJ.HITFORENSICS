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

  const zStyle = (z) => {
    const abs = Math.abs(Number(z));
    if (abs > 3) return { color: '#FF2E63', fontWeight: 700 };
    if (abs > 2.5) return { color: '#F4B936', fontWeight: 700 };
    return { color: '#0E1E3F' };
  };

  return (
    <section>
      <span className="kicker"><span className="dot" />File Q9 · z-score outliers</span>
      <h1>The <em>outliers</em>, decade by decade.</h1>
      <p className="lede">
        Top-10 hits at least <b>two standard deviations</b> from the era mean in danceability,
        energy, or acousticness. Songs that didn't sound like anything else on the chart
        when they peaked. Ahead of the curve, behind it, or just sideways.
      </p>

      <div className="filter-bar">
        <label>Decade</label>
        <select value={decade} onChange={(e) => setDecade(e.target.value)}>
          <option value="">All decades</option>
          {decades.map((d) => (
            <option key={d} value={d}>{d}s</option>
          ))}
        </select>
      </div>

      {status === 'loading' && <p className="loading">Loading outliers</p>}
      {status === 'error' && <p className="error">Failed to load data.</p>}

      {status === 'ok' && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Track</th><th>Artist</th><th>Decade</th><th>Peak</th>
                <th>z dance</th><th>z energy</th><th>z acoustic</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr key={r.track_id}>
                  <td><Link to={`/track/${r.track_id}`}>{r.track_name}</Link></td>
                  <td>{r.artist_name}</td>
                  <td className="num">{r.decade}s</td>
                  <td className="num">#{r.best_peak}</td>
                  <td className="num" style={zStyle(r.z_dance)}>{r.z_dance}</td>
                  <td className="num" style={zStyle(r.z_energy)}>{r.z_energy}</td>
                  <td className="num" style={zStyle(r.z_acoustic)}>{r.z_acoustic}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
