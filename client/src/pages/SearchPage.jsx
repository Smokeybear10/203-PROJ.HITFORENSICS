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
      <h1>Search tracks</h1>
      <input
        type="search"
        placeholder="e.g. blinding lights"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
      />
      {status === 'loading' && <p>Loading…</p>}
      {status === 'error' && <p className="error">Something went wrong.</p>}
      <ul className="results">
        {results.map((r) => (
          <li key={r.track_id}>
            <Link to={`/track/${r.track_id}`}>{r.track_name}</Link>
            <span className="popularity">pop {r.popularity ?? '—'}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
