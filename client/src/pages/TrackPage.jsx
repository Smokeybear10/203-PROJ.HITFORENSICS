import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

export function TrackPage() {
  const { id } = useParams();
  const [track, setTrack] = useState(null);
  const [chart, setChart] = useState([]);
  const [similar, setSimilar] = useState([]);
  const [status, setStatus] = useState('loading');
  const [similarLoading, setSimilarLoading] = useState(true);

  useEffect(() => {
    setStatus('loading');
    setSimilarLoading(true);

    Promise.all([
      api.getTrack(id),
      api.getTrackChart(id).catch(() => []),
    ]).then(([t, c]) => {
      setTrack(t);
      setChart(c);
      setStatus('ok');
    }).catch(() => setStatus('error'));

    api.getSimilarTracks(id)
      .then(setSimilar)
      .catch(() => setSimilar([]))
      .finally(() => setSimilarLoading(false));
  }, [id]);

  if (status === 'loading') return <p>Loading...</p>;
  if (status === 'error') return <p className="error">Track not found.</p>;

  const radarData = [
    { feature: 'Danceability', value: Number(track.danceability) },
    { feature: 'Energy', value: Number(track.energy) },
    { feature: 'Valence', value: Number(track.valence) },
    { feature: 'Acousticness', value: Number(track.acousticness) },
    { feature: 'Instrumental', value: Number(track.instrumentalness) },
    { feature: 'Speechiness', value: Number(track.speechiness) },
    { feature: 'Liveness', value: Number(track.liveness) },
  ];

  const chartData = chart.map((w) => ({
    week: new Date(w.week_date).toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
    rank: w.current_rank,
  }));

  const formatDuration = (ms) => {
    if (!ms) return '—';
    const min = Math.floor(ms / 60000);
    const sec = Math.floor((ms % 60000) / 1000);
    return `${min}:${sec.toString().padStart(2, '0')}`;
  };

  return (
    <section className="track-detail">
      <h1>{track.track_name}</h1>
      <p className="subtle">
        by{' '}
        {track.artist_id
          ? <Link to={`/artist/${track.artist_id}`}>{track.artist_name}</Link>
          : track.artist_name}
      </p>

      <div className="detail-grid">
        <div className="card">
          <h3>Audio Fingerprint</h3>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
              <PolarGrid stroke="#2a303a" />
              <PolarAngleAxis dataKey="feature" tick={{ fill: '#7a8290', fontSize: 12 }} />
              <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke="#8ab4ff" fill="#8ab4ff" fillOpacity={0.3} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {chartData.length > 0 && (
          <div className="card">
            <h3>Chart Trajectory</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2a303a" />
                <XAxis
                  dataKey="week"
                  tick={{ fill: '#7a8290', fontSize: 10 }}
                  interval={Math.max(0, Math.floor(chartData.length / 6))}
                />
                <YAxis
                  reversed
                  domain={[1, 100]}
                  tick={{ fill: '#7a8290' }}
                  label={{ value: 'Rank', angle: -90, position: 'insideLeft', fill: '#7a8290' }}
                />
                <Tooltip
                  contentStyle={{ background: '#161a21', border: '1px solid #2a303a', color: '#e6e8ec' }}
                  formatter={(val) => [`#${val}`, 'Rank']}
                />
                <Line type="monotone" dataKey="rank" stroke="#8ab4ff" dot={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Track Details</h3>
        <div className="stats-grid">
          <div><span className="label">Popularity</span><span>{track.popularity}</span></div>
          <div><span className="label">Tempo</span><span>{Number(track.tempo).toFixed(0)} BPM</span></div>
          <div><span className="label">Loudness</span><span>{track.loudness} dB</span></div>
          <div><span className="label">Key</span><span>{['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'][track.key] ?? '—'}</span></div>
          <div><span className="label">Mode</span><span>{track.mode === 1 ? 'Major' : 'Minor'}</span></div>
          <div><span className="label">Duration</span><span>{formatDuration(track.duration_ms)}</span></div>
          <div><span className="label">Explicit</span><span>{track.explicit ? 'Yes' : 'No'}</span></div>
          <div><span className="label">Time Sig</span><span>{track.time_signature}/4</span></div>
        </div>
      </div>

      <div className="card">
        <h3>Audio Twins</h3>
        {similarLoading ? (
          <p className="subtle">Finding similar tracks...</p>
        ) : similar.length > 0 ? (
          <table className="data-table">
            <thead>
              <tr><th>Track</th><th>Artist</th><th>Distance</th><th>Pop</th></tr>
            </thead>
            <tbody>
              {similar.map((s) => (
                <tr key={s.track_id}>
                  <td><Link to={`/track/${s.track_id}`}>{s.track_name}</Link></td>
                  <td>{s.artist_name}</td>
                  <td>{s.audio_distance}</td>
                  <td>{s.popularity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="subtle">No similar tracks found.</p>
        )}
      </div>
    </section>
  );
}
