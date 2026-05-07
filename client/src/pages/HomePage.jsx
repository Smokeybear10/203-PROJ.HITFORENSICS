import { Link } from 'react-router-dom';

const features = [
  {
    to: '/search',
    qbadge: 'Q1',
    title: 'Song Search',
    desc: '"Type a title. We pull its audio DNA, chart life, and nearest sonic neighbours."',
    swatch: 's1',
    icon: <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6" /><path d="M20 20l-4-4" /></svg>,
    go: 'Search any track →',
  },
  {
    to: '/workbench',
    qbadge: 'Q7',
    title: 'Audio Workbench',
    desc: '"Slide the dials for energy, valence, tempo. See which tracks fit your mood, decade-ranked."',
    swatch: 's2',
    icon: <svg viewBox="0 0 24 24"><path d="M5 4v16M5 12h6M14 4v16M14 8h5" /></svg>,
    go: 'Open the dials →',
  },
  {
    to: '/trajectories',
    qbadge: 'Q8',
    title: 'Trajectory Gallery',
    desc: '"Flash. Slow Burn. Plateau. Five chart-shape archetypes, with their poster songs."',
    swatch: 's3',
    icon: <svg viewBox="0 0 24 24"><path d="M3 18l5-7 4 5 4-9 5 11" /></svg>,
    go: 'Browse archetypes →',
  },
  {
    to: '/era-decoder',
    qbadge: 'Q9',
    title: 'Era Decoder',
    desc: '"The decade-adjusted outliers. Hits that didn\'t sound like the rest of their year."',
    swatch: 's4',
    icon: <svg viewBox="0 0 24 24"><circle cx="6" cy="8" r="1.4" /><circle cx="11" cy="14" r="1.4" /><circle cx="16" cy="6" r="1.4" /><circle cx="20" cy="12" r="1.4" /><circle cx="9" cy="19" r="1.4" /><circle cx="14" cy="11" r="1.4" /></svg>,
    go: 'Spot the outlier →',
  },
  {
    to: '/chemistry',
    qbadge: 'Q10',
    title: 'Collab Chemistry',
    desc: '"Which artist duos chart higher together than apart? The leaderboard reveals all."',
    swatch: 's5',
    icon: <svg viewBox="0 0 24 24"><circle cx="9" cy="12" r="5" /><circle cx="15" cy="12" r="5" /></svg>,
    go: 'See the duos →',
  },
  {
    to: '/top-charts',
    qbadge: 'Q5',
    title: 'Top Charts',
    desc: '"The songs that just would not leave. Longest stays in Billboard Hot 100 history."',
    swatch: 's6',
    icon: <svg viewBox="0 0 24 24"><rect x="3" y="13" width="3" height="8" /><rect x="9" y="9" width="3" height="12" /><rect x="15" y="5" width="3" height="16" /></svg>,
    go: 'Open the leaderboard →',
  },
];

export function HomePage() {
  return (
    <section className="home">
      <span className="kicker"><span className="dot" />An investigation in six parts</span>

      <div className="home-hero">
        <h1 className="headline-display">
          What makes<br />a song a <span className="hit">hit</span><span className="qmark">?</span>
        </h1>
        <div className="lede-block">
          <p className="lede">Sixty‑five years. Four hundred and forty‑seven thousand tracks. The Billboard Hot 100, decoded.</p>
          <div className="lede-meta">
            Built on a join between <b>Billboard Hot 100</b> chart history and <b>Spotify</b>{' '}
            audio features. Ten queries. Nine pages. One question.
          </div>
        </div>
      </div>

      <div className="stats-row">
        <div className="stat-tile brand"><div className="n">447,232</div><div className="l">tracks indexed</div></div>
        <div className="stat-tile"><div className="n">65 yrs</div><div className="l">aug 1958 → nov 2021</div></div>
        <div className="stat-tile"><div className="n">100k</div><div className="l">artists profiled</div></div>
        <div className="stat-tile brand2"><div className="n">280k+</div><div className="l">chart-week observations</div></div>
        <div className="stat-tile"><div className="n">10</div><div className="l">queries · 9 pages</div></div>
      </div>

      <div style={{ marginTop: 28 }}>
        <Link to="/search" className="btn btn-magenta">
          Start the investigation <span className="btn-arr">↗</span>
        </Link>
      </div>

      <div className="section-head">
        <h2>Six lenses on the dataset.</h2>
        <span className="h-sub">10 queries · 9 pages</span>
      </div>

      <div className="feature-grid">
        {features.map((f) => (
          <Link key={f.to} to={f.to} className="feature-card">
            <span className="qbadge">{f.qbadge}</span>
            <div className={`swatch ${f.swatch}`}>{f.icon}</div>
            <h3>{f.title}</h3>
            <p>{f.desc}</p>
            <div className="go">{f.go}</div>
          </Link>
        ))}
      </div>
    </section>
  );
}
