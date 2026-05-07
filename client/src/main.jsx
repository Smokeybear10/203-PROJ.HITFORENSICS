import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import { HomePage } from './pages/HomePage.jsx';
import { SearchPage } from './pages/SearchPage.jsx';
import { TrackPage } from './pages/TrackPage.jsx';
import { WorkbenchPage } from './pages/WorkbenchPage.jsx';
import { TrajectoryPage } from './pages/TrajectoryPage.jsx';
import { EraDecoderPage } from './pages/EraDecoderPage.jsx';
import { ChemistryPage } from './pages/ChemistryPage.jsx';
import { TopChartsPage } from './pages/TopChartsPage.jsx';
import { ArtistPage } from './pages/ArtistPage.jsx';
import './styles.css';

function Layout({ children }) {
  return (
    <div className="app">
      <header className="site-header">
        <NavLink to="/" className="brand" end>
          <span className="blob">Hit</span>Forensics<span className="dot">.</span>
        </NavLink>
        <nav className="site-nav">
          <NavLink to="/search">Search</NavLink>
          <NavLink to="/workbench">Workbench</NavLink>
          <NavLink to="/trajectories">Trajectories</NavLink>
          <NavLink to="/era-decoder">Era Decoder</NavLink>
          <NavLink to="/chemistry">Chemistry</NavLink>
          <NavLink to="/top-charts">Top Charts</NavLink>
        </nav>
      </header>
      <main>{children}</main>
      <footer className="site-footer">
        <span>By <b>Kevin Li, Tommy Ou, Ronnie Wang, Kev Xue.</b></span>
        <span>CIS 5500 · Spring 2026 · University of Pennsylvania</span>
      </footer>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/search" element={<SearchPage />} />
          <Route path="/track/:id" element={<TrackPage />} />
          <Route path="/workbench" element={<WorkbenchPage />} />
          <Route path="/trajectories" element={<TrajectoryPage />} />
          <Route path="/era-decoder" element={<EraDecoderPage />} />
          <Route path="/chemistry" element={<ChemistryPage />} />
          <Route path="/top-charts" element={<TopChartsPage />} />
          <Route path="/artist/:id" element={<ArtistPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </React.StrictMode>
);
