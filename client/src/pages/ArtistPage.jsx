import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';

export function ArtistPage() {
  const { id } = useParams();
  const [artist, setArtist] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    setStatus('loading');
    api.getArtist(id)
      .then((a) => { setArtist(a); setStatus('ok'); })
      .catch(() => setStatus('error'));
  }, [id]);

  if (status === 'loading') return <p>Loading...</p>;
  if (status === 'error') return <p className="error">Artist not found.</p>;

  return (
    <section>
      <h1>{artist.artist_name}</h1>

      <div className="card artist-stats">
        <div>
          <span className="label">Popularity</span>
          <span>{artist.popularity ?? '—'}</span>
        </div>
        <div>
          <span className="label">Followers</span>
          <span>{artist.followers?.toLocaleString() ?? '—'}</span>
        </div>
        {artist.genres && (
          <div>
            <span className="label">Genres</span>
            <span>{artist.genres}</span>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Discography ({artist.tracks.length} tracks)</h3>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Track</th><th>Popularity</th><th>Best Peak</th><th>Weeks on Chart</th>
              </tr>
            </thead>
            <tbody>
              {artist.tracks.map((t) => (
                <tr key={t.track_id}>
                  <td><Link to={`/track/${t.track_id}`}>{t.track_name}</Link></td>
                  <td>{t.popularity ?? '—'}</td>
                  <td>{t.best_peak_rank ? `#${t.best_peak_rank}` : '—'}</td>
                  <td>{t.total_weeks_on_chart ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
