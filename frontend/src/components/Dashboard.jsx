import { useState, useEffect } from 'react';
import './Dashboard.css';

const Dashboard = ({ schema, stats }) => {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatNumber = (num) => {
    if (!num) return '0';
    return parseInt(num).toLocaleString();
  };

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>SYSTEM OVERVIEW</h2>
        <div className="clock neon-text">
          {currentTime.toLocaleTimeString()}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="stats-grid">
        <div className="stat-card panel">
          <div className="stat-icon">📊</div>
          <div className="stat-value neon-text">
            {formatNumber(stats?.total_records)}
          </div>
          <div className="stat-label">Total Records</div>
        </div>

        <div className="stat-card panel">
          <div className="stat-icon">📋</div>
          <div className="stat-value neon-text">
            {stats?.total_tables || 0}
          </div>
          <div className="stat-label">Tables</div>
        </div>

        <div className="stat-card panel">
          <div className="stat-icon">💾</div>
          <div className="stat-value neon-text">
            {stats?.database_size || 'N/A'}
          </div>
          <div className="stat-label">Database Size</div>
        </div>

        <div className="stat-card panel">
          <div className="stat-icon">🔌</div>
          <div className="stat-value neon-text">ACTIVE</div>
          <div className="stat-label">Status</div>
        </div>
      </div>

      {/* Tables Overview */}
      <div className="tables-section">
        <h3>DATABASE TABLES</h3>
        <div className="tables-grid">
          {schema?.tables?.map((table, idx) => (
            <div key={idx} className="table-card panel">
              <div className="table-header">
                <h4>{table.name || table.tablename}</h4>
                <span className="table-badge">{formatNumber(table.rowCount || table.row_count)} rows</span>
              </div>
              <div className="table-info">
                <div className="info-item">
                  <span className="label">Schema:</span>
                  <span className="value">{table.schema || table.schemaname}</span>
                </div>
                {table.size && (
                  <div className="info-item">
                    <span className="label">Size:</span>
                    <span className="value">{table.size}</span>
                  </div>
                )}
                {table.columns && (
                  <div className="info-item">
                    <span className="label">Columns:</span>
                    <span className="value">{table.columns.length}</span>
                  </div>
                )}
              </div>
            </div>
          ))}

          {stats?.tables && !schema?.tables && stats.tables.map((table, idx) => (
            <div key={idx} className="table-card panel">
              <div className="table-header">
                <h4>{table.tablename}</h4>
                <span className="table-badge">{formatNumber(table.row_count)} rows</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* System Info */}
      <div className="system-info panel">
        <h3>SYSTEM INFORMATION</h3>
        <div className="info-grid">
          <div className="info-row">
            <span className="label">Database:</span>
            <span className="value neon-text">Neon PostgreSQL</span>
          </div>
          <div className="info-row">
            <span className="label">Version:</span>
            <span className="value">{stats?.postgres_version?.split(' ')[1] || 'N/A'}</span>
          </div>
          <div className="info-row">
            <span className="label">Last Updated:</span>
            <span className="value">{new Date(schema?.discoveredAt || stats?.timestamp || Date.now()).toLocaleString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
