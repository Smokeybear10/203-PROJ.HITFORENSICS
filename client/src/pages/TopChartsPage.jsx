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

  const rankClass = (i) => {
    if (i === 0) return 'rank-chip gold';
    if (i === 1) return 'rank-chip magenta';
    if (i === 2) return 'rank-chip teal';
    return 'rank-chip';
  };

  return (
    <section>
      <span className="kicker"><span className="dot" />File Q5 · aggregations</span>
      <h1>The songs that <em>just won't leave</em>.</h1>
      <p className="lede">
        Ranked by total weeks on the Billboard Hot 100. Some of these spent more than a
        full year on the chart. Ear-worms, summer anthems, and the occasional Christmas song
        that never logs off.
      </p>

      {status === 'loading' && <p className="loading">Loading the leaderboard</p>}
      {status === 'error' && <p className="error">Failed to load data.</p>}
      {status === 'ok' && (
      <div className="table-wrap" style={{ marginTop: 28 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>Track</th><th>Artist</th><th>Weeks on chart</th><th>Best peak</th>
            </tr>
          </thead>
          <tbody>
            {tracks.map((t, i) => (
              <tr key={t.track_id}>
                <td><span className={rankClass(i)}>{i + 1}</span></td>
                <td><Link to={`/track/${t.track_id}`}>{t.track_name}</Link></td>
                <td>{t.artist_name}</td>
                <td className="num">{t.total_weeks}</td>
                <td className="num">#{t.best_peak}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}
