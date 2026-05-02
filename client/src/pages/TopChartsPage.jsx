import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export function TopChartsPage() {
  const [tracks, setTracks] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api.getTopCharts()
      .then((d) => { setTracks(d); setStatus('ok'); })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') return <p>Loading...</p>;
  if (status === 'error') return <p className="error">Failed to load data.</p>;

  return (
    <section>
      <h1>Top Charts</h1>
      <p className="subtle">
        The longest-running songs in Billboard Hot 100 history, ranked by total weeks on the chart.
      </p>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>Track</th><th>Artist</th><th>Weeks on Chart</th><th>Best Peak</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t, i) => (
              <tr key={t.track_id}>
                <td>{i + 1}</td>
                <td><Link to={`/track/${t.track_id}`}>{t.track_name}</Link></td>
                <td>{t.artist_name}</td>
                <td>{t.total_weeks}</td>
                <td>#{t.best_peak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
