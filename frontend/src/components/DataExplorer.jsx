import { useState, useEffect } from 'react';
import axios from 'axios';
import './DataExplorer.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const DataExplorer = ({ schema }) => {
  const [selectedTable, setSelectedTable] = useState(null);
  const [tableData, setTableData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [limit] = useState(50);

  const tables = schema?.tables || [];

  useEffect(() => {
    if (tables.length > 0 && !selectedTable) {
      setSelectedTable(tables[0]);
    }
  }, [tables]);

  useEffect(() => {
    if (selectedTable) {
      fetchTableData();
    }
  }, [selectedTable, page, searchTerm]);

  const fetchTableData = async () => {
    if (!selectedTable) return;

    setLoading(true);
    try {
      const tableName = selectedTable.name || selectedTable.tablename;

      if (searchTerm) {
        // Search
        const response = await axios.post(`${API_URL}/api/search`, {
          table: tableName,
          searchTerm,
          limit
        });
        setTableData(response.data);
      } else {
        // Normal query
        const response = await axios.post(`${API_URL}/api/query`, {
          table: tableName,
          limit,
          offset: page * limit
        });
        setTableData(response.data);
      }
    } catch (error) {
      console.error('Error fetching table data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTableSelect = (table) => {
    setSelectedTable(table);
    setPage(0);
    setSearchTerm('');
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(0);
    fetchTableData();
  };

  return (
    <div className="data-explorer">
      <h2>DATA EXPLORER</h2>

      <div className="explorer-layout">
        {/* Sidebar - Table List */}
        <div className="sidebar panel">
          <h3>TABLES</h3>
          <div className="table-list">
            {tables.map((table, idx) => {
              const tableName = table.name || table.tablename;
              const rowCount = table.rowCount || table.row_count || 0;
              return (
                <div
                  key={idx}
                  className={`table-item ${selectedTable?.name === tableName || selectedTable?.tablename === tableName ? 'active' : ''}`}
                  onClick={() => handleTableSelect(table)}
                >
                  <span className="table-name">{tableName}</span>
                  <span className="table-rows">{parseInt(rowCount).toLocaleString()}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Main Area - Data View */}
        <div className="main-area">
          {selectedTable && (
            <>
              {/* Search Bar */}
              <div className="search-bar panel">
                <form onSubmit={handleSearch}>
                  <input
                    type="text"
                    placeholder="Search data..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <button type="submit">SEARCH</button>
                  {searchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchTerm('');
                        setPage(0);
                      }}
                    >
                      CLEAR
                    </button>
                  )}
                </form>
              </div>

              {/* Data Table */}
              {loading ? (
                <div className="loading-container">
                  <div className="loader"></div>
                  <p className="neon-text">LOADING DATA...</p>
                </div>
              ) : tableData?.data?.length > 0 ? (
                <div className="data-view panel">
                  <div className="table-header-info">
                    <h3>{selectedTable.name || selectedTable.tablename}</h3>
                    <span className="record-count">
                      Showing {tableData.data.length} of {tableData.total?.toLocaleString() || 0} records
                    </span>
                  </div>

                  <div className="table-wrapper">
                    <table>
                      <thead>
                        <tr>
                          {tableData.data[0] && Object.keys(tableData.data[0]).map((key, idx) => (
                            <th key={idx}>{key}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {tableData.data.map((row, rowIdx) => (
                          <tr key={rowIdx}>
                            {Object.values(row).map((value, colIdx) => (
                              <td key={colIdx}>
                                {value !== null && value !== undefined
                                  ? String(value).length > 50
                                    ? String(value).substring(0, 50) + '...'
                                    : String(value)
                                  : 'NULL'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Pagination */}
                  <div className="pagination">
                    <button
                      onClick={() => setPage(Math.max(0, page - 1))}
                      disabled={page === 0}
                    >
                      PREVIOUS
                    </button>
                    <span className="page-info">
                      Page {page + 1} of {Math.ceil((tableData.total || 0) / limit)}
                    </span>
                    <button
                      onClick={() => setPage(page + 1)}
                      disabled={(page + 1) * limit >= (tableData.total || 0)}
                    >
                      NEXT
                    </button>
                  </div>
                </div>
              ) : (
                <div className="no-data panel">
                  <p className="neon-text">NO DATA FOUND</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default DataExplorer;
