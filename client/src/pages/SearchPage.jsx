import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

export function SearchPage() {
  const [q, setQ] = useState('');
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState('idle');

  useEffect(() => {
    if (!q.trim()) {
      setResults([]);
      setStatus('idle');
      return;
    }
    const handle = setTimeout(async () => {
      setStatus('loading');
      try {
        setResults(await api.searchTracks(q));
        setStatus('ok');
      } catch (err) {
        console.error(err);
        setStatus('error');
      }
    }, 200);
    return () => clearTimeout(handle);
  }, [q]);

  return (
    <section>
      <span className="kicker"><span className="dot" />File Q1 · fuzzy match</span>
      <h1>Search the <em>vault</em>.</h1>
      <p className="lede">
        Type a title or an artist. We pull the <b>audio fingerprint</b>, chart life,
        and nearest sonic neighbours from 447,232 indexed tracks.
      </p>

      <div style={{ marginTop: 28 }}>
        <input
          type="search"
          placeholder="e.g. blinding lights, dolly parton, take on me…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
      </div>

      {status === 'loading' && <p className="loading">Searching</p>}
      {status === 'error' && <p className="error">Something went wrong on our end.</p>}
      {status === 'ok' && results.length === 0 && (
        <p className="subtle" style={{ marginTop: 24 }}>No matches. Try a partial title or artist.</p>
      )}

      {results.length > 0 && (
        <ul className="results">
          {results.map((r) => (
            <li key={r.track_id}>
              <div>
                <Link to={`/track/${r.track_id}`} className="track-title">
                  {r.track_name}
                </Link>
                
                {/* Map through the array of artists */}
                {r.artists && r.artists.length > 0 && (
                  <span className="artist-name">
                    —{' '}
                    {r.artists.map((artist, index) => (
                      <span key={artist.artist_id}>
                        {artist.artist_name}
                        {/* Add a comma between artists, but not after the last one */}
                        {index < r.artists.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </span>
                )}
              </div>
              <span className="popularity">pop · {r.popularity ?? '—'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
