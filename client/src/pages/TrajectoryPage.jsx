import { useEffect, useState } from 'react';
import { api } from '../api.js';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, Legend,
} from 'recharts';

const INK = '#0E1E3F';
const INK_LINE = 'rgba(14,30,63,0.18)';
const PALETTE = ['#FF2E63', '#F4B936', '#2BB3A1', '#0E1E3F', '#A0537C'];

const descriptions = {
  Flash: 'Peaks within 3 weeks of debut, drops off the chart within 10.',
  Sleeper: 'Debuts below #50, climbs to peak 20+ weeks later.',
  'Slow Burn': 'Peak 10+ weeks after debut, total run 25+ weeks.',
  'Sustained Hit': 'Peaks in top 10, stays in top 40 for 15+ weeks.',
  Other: "Doesn't fit the four main trajectory patterns.",
};

export function TrajectoryPage() {
  const [data, setData] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api.getTrajectories()
      .then((d) => { setData(d); setStatus('ok'); })
      .catch(() => setStatus('error'));
  }, []);

  const radarData = ['danceability', 'energy', 'valence', 'acousticness'].map((feat) => {
    const point = { feature: feat.charAt(0).toUpperCase() + feat.slice(1) };
    data.forEach((d) => { point[d.archetype] = Number(d[`avg_${feat}`]); });
    return point;
  });

  return (
    <section>
      <span className="kicker"><span className="dot" />File Q8 · window functions</span>
      <h1>Every hit has <em>a shape</em>.</h1>
      <p className="lede">
        We classify charting songs into five archetypes by when they peaked, how fast they
        climbed, and how long they lasted. <b>Flash. Sleeper. Slow Burn. Sustained Hit.</b>
        And everything in between.
      </p>

      {status === 'loading' && <p className="loading">Loading archetypes</p>}
      {status === 'error' && <p className="error">Failed to load trajectory data.</p>}
      {status === 'ok' && <>
      <div className="card" style={{ marginTop: 28 }}>
        <h3>Track count by archetype</h3>
        <p className="card-sub">How many of the 447,232 indexed tracks fit each shape.</p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={INK_LINE} />
            <XAxis dataKey="archetype" tick={{ fill: INK, fontSize: 12, fontFamily: 'Inter' }} />
            <YAxis tick={{ fill: INK, fontSize: 11, fontFamily: 'JetBrains Mono' }} />
            <Tooltip />
            <Bar dataKey="track_count" fill="#F4B936" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card">
        <h3>Audio profile, side-by-side</h3>
        <p className="card-sub">Average danceability, energy, valence, and acousticness per archetype.</p>
        <ResponsiveContainer width="100%" height={380}>
          <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="68%">
            <PolarGrid stroke={INK_LINE} />
            <PolarAngleAxis dataKey="feature" tick={{ fill: INK, fontSize: 12, fontFamily: 'JetBrains Mono' }} />
            <PolarRadiusAxis domain={[0, 1]} tick={false} axisLine={false} />
            {data.map((d, i) => (
              <Radar key={d.archetype} name={d.archetype} dataKey={d.archetype}
                stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.18} strokeWidth={2} />
            ))}
            <Legend wrapperStyle={{ fontFamily: 'Inter', fontSize: 13 }} />
            <Tooltip />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="section-head">
        <h2>The archetypes.</h2>
        <span className="h-sub">five ways a song lives</span>
      </div>


      <div className="archetype-grid">
        {data.map((a, i) => (
          <div key={a.archetype} className="card archetype-card">
            <span className="arch-label">archetype {String(i + 1).padStart(2, '0')}</span>
            <h3>{a.archetype}</h3>
            <p className="subtle">{descriptions[a.archetype]}</p>
            <div className="archetype-stats">
              <span className="count"><b>{Number(a.track_count).toLocaleString()}</b> tracks</span>
              <span>danceability · {a.avg_danceability}</span>
              <span>energy · {a.avg_energy}</span>
              <span>valence · {a.avg_valence}</span>
              <span>acousticness · {a.avg_acousticness}</span>
              <span>tempo · {a.avg_tempo} BPM</span>
            </div>
          </div>
        ))}
      </div>
      </>}
    </section>
  );
}
