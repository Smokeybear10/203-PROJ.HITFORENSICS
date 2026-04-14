import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { SearchPage } from './pages/SearchPage.jsx';
import { TrackPage } from './pages/TrackPage.jsx';
import './styles.css';

function Layout({ children }) {
  return (
    <div className="app">
      <header>
        <Link to="/" className="brand">Hit Forensics</Link>
      </header>
      <main>{children}</main>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<SearchPage />} />
          <Route path="/track/:id" element={<TrackPage />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  </React.StrictMode>
);
