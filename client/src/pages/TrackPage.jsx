import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../api.js';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';

const INK = '#0E1E3F';
const INK_LINE = 'rgba(14,30,63,0.18)';
const MAGENTA = '#FF2E63';
const MUSTARD = '#F4B936';

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

  if (status === 'loading') return <p className="loading">Pulling the file</p>;
  if (status === 'error') return <p className="error">Track not found.</p>;

  const radarData = [
    { feature: 'Danceability', value: Number(track.danceability) },
    { feature: 'Energy', value: Number(track.energy) },
    { feature: 'Valence', value: Number(track.valence) },
    { feature: 'Acoustic', value: Number(track.acousticness) },
    { feature: 'Instrum.', value: Number(track.instrumentalness) },
    { feature: 'Speech', value: Number(track.speechiness) },
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
      <span className="kicker"><span className="dot" />Song spotlight · file Q2 + Q4 + Q6</span>
      <h1><em>{track.track_name}</em></h1>
      <p className="lede">
        by{' '}
        {track.artists && track.artists.map((artist, index) => (
          <span key={artist.artist_id}>
            <Link 
              to={`/artist/${artist.artist_id}`} 
              style={{ borderBottom: '2px solid currentColor' }}
            >
              {artist.artist_name}
            </Link>
            {/* Add a comma and space between artists, but not after the last one */}
            {index < track.artists.length - 1 ? ', ' : ''}
          </span>
        ))}
      </p>

      <div className="detail-grid">
        <div className="card">
          <h3>Audio fingerprint</h3>
          <p className="card-sub">A seven-feature radar from Spotify's audio analysis.</p>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="72%">
              <PolarGrid stroke={INK_LINE} />
              <PolarAngleAxis dataKey="feature" tick={{ fill: INK, fontSize: 11, fontFamily: 'JetBrains Mono' }} />
              <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
              <Radar dataKey="value" stroke={MAGENTA} fill={MAGENTA} fillOpacity={0.28} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {chartData.length > 0 && (
          <div className="card">
            <h3>Chart trajectory</h3>
            <p className="card-sub">Weekly Billboard Hot 100 position. Lower is better.</p>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={INK_LINE} />
                <XAxis
                  dataKey="week"
                  tick={{ fill: INK, fontSize: 10, fontFamily: 'JetBrains Mono' }}
                  interval={Math.max(0, Math.floor(chartData.length / 6))}
                />
                <YAxis
                  reversed
                  domain={[1, 100]}
                  tick={{ fill: INK, fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
                <Tooltip formatter={(val) => [`#${val}`, 'Rank']} />
                <Line type="monotone" dataKey="rank" stroke={MUSTARD} dot={false} strokeWidth={2.5} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Track details</h3>
        <div className="stats-grid">
          <div><span className="label">Popularity</span><span>{track.popularity ?? '—'}</span></div>
          <div><span className="label">Tempo</span><span>{Number(track.tempo).toFixed(0)} BPM</span></div>
          <div><span className="label">Loudness</span><span>{track.loudness} dB</span></div>
          <div><span className="label">Key</span><span>{['C','C♯','D','D♯','E','F','F♯','G','G♯','A','A♯','B'][track.key] ?? '—'}</span></div>
          <div><span className="label">Mode</span><span>{track.mode === 1 ? 'Major' : 'Minor'}</span></div>
          <div><span className="label">Duration</span><span>{formatDuration(track.duration_ms)}</span></div>
          <div><span className="label">Explicit</span><span>{track.explicit ? 'Yes' : 'No'}</span></div>
          <div><span className="label">Time sig</span><span>{track.time_signature}/4</span></div>
        </div>
      </div>

      <div className="card">
        <h3>Audio twins</h3>
        <p className="card-sub">Nearest neighbours by cube distance across the audio-feature vector.</p>
        {similarLoading ? (
          <p className="loading">Finding similar tracks</p>
        ) : similar.length > 0 ? (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Track</th><th>Artist</th><th>Distance</th><th>Pop</th></tr>
              </thead>
              <tbody>
                {similar.map((s) => (
                  <tr key={s.track_id}>
                    <td><Link to={`/track/${s.track_id}`}>{s.track_name}</Link></td>
                    <td>{s.artist_name}</td>
                    <td className="num">{s.audio_distance}</td>
                    <td className="num">{s.popularity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="subtle">No similar tracks found.</p>
        )}
      </div>
    </section>
  );
}
