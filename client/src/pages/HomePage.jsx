import { Link } from 'react-router-dom';

const features = [
  { to: '/search', title: 'Song Search', desc: 'Find any track and explore its audio DNA and chart history.' },
  { to: '/workbench', title: 'Audio Workbench', desc: 'Filter songs by danceability, energy, valence, and tempo — see how they ranked in their decade.' },
  { to: '/trajectories', title: 'Trajectory Gallery', desc: 'How do hits rise and fall? Five chart-shape archetypes from Flash to Slow Burn.' },
  { to: '/era-decoder', title: 'Era Decoder', desc: 'Which top-10 hits were sonic outliers for their decade?' },
  { to: '/chemistry', title: 'Collab Chemistry', desc: 'Which artist duos make chart magic together?' },
  { to: '/top-charts', title: 'Top Charts', desc: 'The longest-running songs in Billboard Hot 100 history.' },
];

export function HomePage() {
  return (
    <section className="home">
      <div className="hero">
        <h1>Hit Forensics</h1>
        <p className="tagline">
          What makes a song a hit? Explore 65 years of Billboard Hot 100 chart history
          fused with Spotify audio features across 447,000+ tracks.
        </p>
        <Link to="/search" className="hero-cta">Start exploring</Link>
      </div>
      <div className="feature-grid">
        {features.map((f) => (
          <Link key={f.to} to={f.to} className="feature-card">
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
          </Link>
        ))}
      </div>
    </section>
  );
}
