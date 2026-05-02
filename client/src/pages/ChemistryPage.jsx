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

  if (status === 'loading') return <p>Loading...</p>;
  if (status === 'error') return <p className="error">Failed to load data.</p>;

  return (
    <section>
      <h1>Collab Chemistry</h1>
      <p className="subtle">
        Artist pairs ranked by "chemistry uplift", the gap between their joint average peak rank
        and the average of their solo peak ranks. A higher uplift means the duo charts significantly
        better together than apart. (Lower rank number = better chart position.)
      </p>

      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>#</th><th>Artist 1</th><th>Artist 2</th>
              <th>Joint Hits</th><th>Joint Avg Peak</th>
              <th>A1 Solo Avg</th><th>A2 Solo Avg</th>
              <th>Uplift</th>
            </tr>
          </thead>
          <tbody>
            {pairs.map((p, i) => (
              <tr key={i}>
                <td>{i + 1}</td>
                <td>{p.artist_1}</td>
                <td>{p.artist_2}</td>
                <td>{p.joint_hits}</td>
                <td>#{p.joint_avg_peak}</td>
                <td>#{p.artist_1_solo_avg}</td>
                <td>#{p.artist_2_solo_avg}</td>
                <td className="uplift">+{p.chemistry_uplift}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
