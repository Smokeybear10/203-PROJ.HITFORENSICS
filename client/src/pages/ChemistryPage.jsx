import { useEffect, useState } from 'react';
import { api } from '../api.js';

export function ChemistryPage() {
  const [pairs, setPairs] = useState([]);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    api.getChemistry()
      .then((d) => { setPairs(d); setStatus('ok'); })
      .catch(() => setStatus('error'));
  }, []);

  const rankClass = (i) => {
    if (i === 0) return 'rank-chip gold';
    if (i === 1) return 'rank-chip magenta';
    if (i === 2) return 'rank-chip teal';
    return 'rank-chip';
  };

  return (
    <section>
      <span className="kicker"><span className="dot" />File Q10 · self-join</span>
      <h1>Two artists. <em>One chart magic.</em></h1>
      <p className="lede">
        Every duo's <b>chemistry uplift</b> is the gap between their joint average peak rank
        and the average of their solo peak ranks. A higher uplift means the pair charts
        meaningfully better together than apart. Lower rank number = better chart position.
      </p>

      {status === 'loading' && <p className="loading">Calculating chemistry</p>}
      {status === 'error' && <p className="error">Failed to load data.</p>}
      {status === 'ok' && (
      <div className="table-wrap" style={{ marginTop: 28 }}>
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>Artist 1</th><th>Artist 2</th>
              <th>Joint hits</th><th>Joint avg peak</th>
              <th>A1 solo avg</th><th>A2 solo avg</th>
              <th>Uplift</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p, i) => (
              <tr key={i}>
                <td><span className={rankClass(i)}>{i + 1}</span></td>
                <td>{p.artist_1}</td>
                <td>{p.artist_2}</td>
                <td className="num">{p.joint_hits}</td>
                <td className="num">#{p.joint_avg_peak}</td>
                <td className="num">#{p.artist_1_solo_avg}</td>
                <td className="num">#{p.artist_2_solo_avg}</td>
                <td className="uplift">+{p.chemistry_uplift}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      )}
    </section>
  );
}
