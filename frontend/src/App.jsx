import { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';
import Dashboard from './components/Dashboard';
import DataExplorer from './components/DataExplorer';
import Analytics from './components/Analytics';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function App() {
  const [view, setView] = useState('dashboard');
  const [schema, setSchema] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    fetchInitialData();
    checkHealth();
  }, []);

  const checkHealth = async () => {
    try {
      await axios.get(`${API_URL}/api/health`);
      setConnected(true);
    } catch (error) {
      console.error('Backend not connected:', error);
      setConnected(false);
    }
  };

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [schemaRes, statsRes] = await Promise.all([
        axios.get(`${API_URL}/api/schema`),
        axios.get(`${API_URL}/api/stats`)
      ]);
      setSchema(schemaRes.data);
      setStats(statsRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <h1 className="title">
            <span className="glitch" data-text="WATCHTOWER">WATCHTOWER</span>
          </h1>
          <div className="header-status">
            <div className={`status-indicator ${connected ? 'connected' : 'disconnected'}`}>
              <span className="status-dot"></span>
              <span>{connected ? 'ONLINE' : 'OFFLINE'}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="nav">
        <button
          className={view === 'dashboard' ? 'active' : ''}
          onClick={() => setView('dashboard')}
        >
          DASHBOARD
        </button>
        <button
          className={view === 'explorer' ? 'active' : ''}
          onClick={() => setView('explorer')}
        >
          DATA EXPLORER
        </button>
        <button
          className={view === 'analytics' ? 'active' : ''}
          onClick={() => setView('analytics')}
        >
          ANALYTICS
        </button>
      </nav>

      {/* Main Content */}
      <main className="main-content">
        {loading ? (
          <div className="loading-container">
            <div className="loader"></div>
            <p className="neon-text">INITIALIZING SYSTEMS...</p>
          </div>
        ) : (
          <>
            {view === 'dashboard' && <Dashboard schema={schema} stats={stats} />}
            {view === 'explorer' && <DataExplorer schema={schema} />}
            {view === 'analytics' && <Analytics schema={schema} />}
          </>
        )}
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="footer-content">
          <span className="neon-text">WATCHTOWER v1.0.0</span>
          <span>|</span>
          <span>NEON DATABASE</span>
          <span>|</span>
          <span>{stats?.total_records?.toLocaleString() || 0} RECORDS</span>
        </div>
      </footer>
    </div>
  );
}

export default App;
