import { useState, useEffect } from 'react';
import axios from 'axios';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';
import './Analytics.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const COLORS = ['#00ffff', '#ff00ff', '#9d00ff', '#ff006e', '#0080ff', '#00ff9d', '#ff9d00', '#9dff00'];

const Analytics = ({ schema }) => {
  const [selectedTable, setSelectedTable] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [groupByColumn, setGroupByColumn] = useState('');
  const [columns, setColumns] = useState([]);

  const tables = schema?.tables || [];

  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0]);
    }
  }, [tables]);

  useEffect(() => {
    if (selectedTable) {
      fetchTableDetails();
    }
  }, [selectedTable]);

  useEffect(() => {
    if (groupByColumn && selectedTable) {
      fetchAnalytics();
    }
  }, [groupByColumn, selectedTable]);

  const fetchTableDetails = async () => {
    try {
      const tableName = selectedTable.name || selectedTable.tablename;
      const response = await axios.get(`${API_URL}/api/tables/${tableName}`);
      setColumns(response.data.columns || selectedTable.columns || []);

      // Auto-select first column for grouping
      if (response.data.columns && response.data.columns.length > 0) {
        setGroupByColumn(response.data.columns[0].column_name);
      }
    } catch (error) {
      console.error('Error fetching table details:', error);
    }
  };

  const fetchAnalytics = async () => {
    if (!selectedTable || !groupByColumn) return;

    setLoading(true);
    try {
      const tableName = selectedTable.name || selectedTable.tablename;
      const response = await axios.get(`${API_URL}/api/analytics/${tableName}`, {
        params: { groupBy: groupByColumn }
      });
      setAnalyticsData(response.data);
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="analytics">
      <h2>ANALYTICS DASHBOARD</h2>

      <div className="analytics-controls panel">
        <div className="control-group">
          <label>TABLE:</label>
          <select
            value={selectedTable?.name || selectedTable?.tablename || ''}
            onChange={(e) => {
              const table = tables.find(t => (t.name || t.tablename) === e.target.value);
              setSelectedTable(table);
              setGroupByColumn('');
              setAnalyticsData(null);
            }}
          >
            {tables.map((table, idx) => (
              <option key={idx} value={table.name || table.tablename}>
                {table.name || table.tablename}
              </option>
            ))}
          </select>
        </div>

        <div className="control-group">
          <label>GROUP BY:</label>
          <select
            value={groupByColumn}
            onChange={(e) => setGroupByColumn(e.target.value)}
            disabled={!columns.length}
          >
            <option value="">Select Column...</option>
            {columns.map((col, idx) => (
              <option key={idx} value={col.column_name || col.name}>
                {col.column_name || col.name}
              </option>
            ))}
          </select>
        </div>

        <button onClick={fetchAnalytics} disabled={!groupByColumn}>
          GENERATE
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loader"></div>
          <p className="neon-text">ANALYZING DATA...</p>
        </div>
      ) : analyticsData && analyticsData.length > 0 ? (
        <div className="charts-container">
          {/* Bar Chart */}
          <div className="chart-panel panel">
            <h3>DISTRIBUTION - BAR CHART</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={analyticsData.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,255,255,0.1)" />
                <XAxis
                  dataKey="label"
                  stroke="#00ffff"
                  tick={{ fill: '#e0e0ff', fontSize: 12 }}
                  angle={-45}
                  textAnchor="end"
                  height={100}
                />
                <YAxis
                  stroke="#00ffff"
                  tick={{ fill: '#e0e0ff', fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    border: '1px solid #00ffff',
                    borderRadius: '4px',
                    color: '#e0e0ff'
                  }}
                />
                <Bar dataKey="value" fill="#00ffff">
                  {analyticsData.slice(0, 10).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie Chart */}
          <div className="chart-panel panel">
            <h3>DISTRIBUTION - PIE CHART</h3>
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={analyticsData.slice(0, 8)}
                  dataKey="value"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  {analyticsData.slice(0, 8).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'rgba(26, 26, 46, 0.95)',
                    border: '1px solid #00ffff',
                    borderRadius: '4px',
                    color: '#e0e0ff'
                  }}
                />
                <Legend
                  wrapperStyle={{ color: '#e0e0ff' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Data Table */}
          <div className="data-table-panel panel">
            <h3>DATA BREAKDOWN</h3>
            <div className="analytics-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>RANK</th>
                    <th>{groupByColumn.toUpperCase()}</th>
                    <th>COUNT</th>
                    <th>PERCENTAGE</th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData.map((item, idx) => {
                    const total = analyticsData.reduce((sum, i) => sum + parseInt(i.value), 0);
                    const percentage = ((parseInt(item.value) / total) * 100).toFixed(2);
                    return (
                      <tr key={idx}>
                        <td>{idx + 1}</td>
                        <td>{item.label || 'NULL'}</td>
                        <td className="neon-text">{parseInt(item.value).toLocaleString()}</td>
                        <td>{percentage}%</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="no-data panel">
          <p className="neon-text">SELECT TABLE AND COLUMN TO VIEW ANALYTICS</p>
        </div>
      )}
    </div>
  );
};

export default Analytics;
