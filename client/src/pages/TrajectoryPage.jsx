import { useEffect, useState } from 'react';
import { api } from '../api.js';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
} from 'recharts';

const descriptions = {
  Flash: 'Peaks within 3 weeks of debut, drops off the chart within 10.',
  Sleeper: 'Debuts below #50, climbs to peak 20+ weeks later.',
  'Slow Burn': 'Peak 10+ weeks after debut, total run 25+ weeks.',
  'Sustained Hit': 'Peaks in top 10, stays in top 40 for 15+ weeks.',
  Other: 'Doesn\'t fit the four main trajectory patterns.',
};

export function TrajectoryPage() {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api.getTrajectories()
      .then((d) => { setData(d); setStatus('ok'); })
      .catch(() => setStatus('error'));
  }, []);

  if (status === 'loading') return <p>Loading...</p>;
  if (status === 'error') return <p className="error">Failed to load trajectory data.</p>;

  const radarData = ['danceability', 'energy', 'valence', 'acousticness'].map((feat) => {
    const point = { feature: feat.charAt(0).toUpperCase() + feat.slice(1) };
    data.forEach((d) => { point[d.archetype] = Number(d[`avg_${feat}`]); });
    return point;
  });

  const colors = ['#8ab4ff', '#69db7c', '#ffa94d', '#ff6b6b', '#7a8290'];

  return (
    <section>
      <h1>Trajectory Gallery</h1>
      <p className="subtle">
        Every charting song has a shape. We classify them into five archetypes based on
        when they peaked, how fast they climbed, and how long they lasted.
      </p>

      <div className="card">
        <h3>Track Count by Archetype</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a303a" />
            <XAxis dataKey="archetype" tick={{ fill: '#7a8290' }} />
            <YAxis tick={{ fill: '#7a8290' }} />
            <Tooltip contentStyle={{ background: '#161a21', border: '1px solid #2a303a', color: '#e6e8ec' }} />
            <Bar dataKey="track_count" fill="#8ab4ff" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3>Audio Profile Comparison</h3>
        <ResponsiveContainer width="100%" height={350}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="65%">
            <PolarGrid stroke="#2a303a" />
            <PolarAngleAxis dataKey="feature" tick={{ fill: '#7a8290', fontSize: 12 }} />
            <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
            {data.map((d, i) => (
              <Radar key={d.archetype} name={d.archetype} dataKey={d.archetype}
                stroke={colors[i]} fill={colors[i]} fillOpacity={0.15} />
            ))}
            <Tooltip contentStyle={{ background: '#161a21', border: '1px solid #2a303a', color: '#e6e8ec' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="archetype-grid">
        {data.map((a) => (
          <div key={a.archetype} className="card archetype-card">
            <h3>{a.archetype}</h3>
            <p className="subtle">{descriptions[a.archetype]}</p>
            <div className="archetype-stats">
              <span><strong>{Number(a.track_count).toLocaleString()}</strong> tracks</span>
              <span>Avg danceability: {a.avg_danceability}</span>
              <span>Avg energy: {a.avg_energy}</span>
              <span>Avg valence: {a.avg_valence}</span>
              <span>Avg acousticness: {a.avg_acousticness}</span>
              <span>Avg tempo: {a.avg_tempo} BPM</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
