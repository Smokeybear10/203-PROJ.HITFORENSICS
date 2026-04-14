import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api.js';

export function TrackPage() {
  const { id } = useParams();
  const [track, setTrack] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    setStatus('loading');
    api.getTrack(id)
      .then((t) => { setTrack(t); setStatus('ok'); })
      .catch((err) => { console.error(err); setStatus('error'); });
  }, [id]);

  if (status === 'loading') return <p>Loading…</p>;
  if (status === 'error') return <p className="error">Track not found.</p>;

  return (
    <section>
      <h1>{track.track_name}</h1>
      <p className="subtle">by {track.artist_name}</p>
      <pre className="json">{JSON.stringify(track, null, 2)}</pre>
    </section>
  );
}
