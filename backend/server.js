import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import dotenv from 'dotenv';
import pool from './db.js';
import { readFileSync, existsSync } from 'fs';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(compression());
app.use(express.json());

// Create HTTP server
const server = createServer(app);

// WebSocket server for real-time updates
const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket client connected');

  ws.on('message', (message) => {
    console.log('📨 Received:', message.toString());
  });

  ws.on('close', () => {
    console.log('🔌 WebSocket client disconnected');
  });
});

// Broadcast function for real-time updates
function broadcast(data) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(JSON.stringify(data));
    }
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'online', timestamp: new Date().toISOString() });
});

// Get database schema
app.get('/api/schema', async (req, res) => {
  try {
    if (existsSync('database-schema.json')) {
      const schema = JSON.parse(readFileSync('database-schema.json', 'utf8'));
      res.json(schema);
    } else {
      // Discover schema on-the-fly
      const tablesQuery = `
        SELECT
          t.schemaname,
          t.tablename,
          COALESCE(s.n_live_tup, 0) as row_count
        FROM pg_tables t
        LEFT JOIN pg_stat_user_tables s ON t.tablename = s.relname AND t.schemaname = s.schemaname
        WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY COALESCE(s.n_live_tup, 0) DESC;
      `;

      const result = await pool.query(tablesQuery);
      res.json({
        tables: result.rows,
        totalRecords: result.rows.reduce((sum, t) => sum + parseInt(t.row_count), 0),
        discoveredAt: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Schema error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Dynamic query endpoint - query any table
app.post('/api/query', async (req, res) => {
  try {
    const { table, limit = 100, offset = 0, where, orderBy, columns = '*' } = req.body;

    if (!table) {
      return res.status(400).json({ error: 'Table name is required' });
    }

    // Validate table exists
    const tableCheck = await pool.query(
      `SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      )`,
      [table]
    );

    if (!tableCheck.rows[0].exists) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Build query
    let query = `SELECT ${columns} FROM ${table}`;
    const params = [];
    let paramCount = 1;

    if (where) {
      query += ` WHERE ${where}`;
    }

    if (orderBy) {
      query += ` ORDER BY ${orderBy}`;
    }

    query += ` LIMIT $${paramCount++} OFFSET $${paramCount}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM ${table}${where ? ` WHERE ${where}` : ''}`;
    const countResult = await pool.query(countQuery);

    res.json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
      table
    });
  } catch (error) {
    console.error('Query error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get table details
app.get('/api/tables/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;

    // Get columns
    const columnsQuery = `
      SELECT
        column_name,
        data_type,
        character_maximum_length,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position;
    `;

    const columnsResult = await pool.query(columnsQuery, [tableName]);

    // Get row count
    const countResult = await pool.query(`SELECT COUNT(*) FROM ${tableName}`);

    // Get sample data
    const sampleResult = await pool.query(`SELECT * FROM ${tableName} LIMIT 5`);

    res.json({
      name: tableName,
      columns: columnsResult.rows,
      rowCount: parseInt(countResult.rows[0].count),
      sampleData: sampleResult.rows
    });
  } catch (error) {
    console.error('Table details error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Analytics endpoint - get aggregated stats
app.get('/api/analytics/:tableName', async (req, res) => {
  try {
    const { tableName } = req.params;
    const { groupBy, metric, aggregation = 'count' } = req.query;

    let query;
    if (groupBy && metric) {
      query = `
        SELECT
          ${groupBy} as label,
          ${aggregation.toUpperCase()}(${metric}) as value
        FROM ${tableName}
        GROUP BY ${groupBy}
        ORDER BY value DESC
        LIMIT 20
      `;
    } else if (groupBy) {
      query = `
        SELECT
          ${groupBy} as label,
          COUNT(*) as value
        FROM ${tableName}
        GROUP BY ${groupBy}
        ORDER BY value DESC
        LIMIT 20
      `;
    } else {
      query = `SELECT COUNT(*) as total FROM ${tableName}`;
    }

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search endpoint - full-text search across columns
app.post('/api/search', async (req, res) => {
  try {
    const { table, searchTerm, columns, limit = 50 } = req.body;

    if (!table || !searchTerm) {
      return res.status(400).json({ error: 'Table and searchTerm are required' });
    }

    // Get searchable columns if not provided
    let searchColumns = columns;
    if (!searchColumns) {
      const columnsQuery = `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        AND data_type IN ('character varying', 'text', 'character')
      `;
      const columnsResult = await pool.query(columnsQuery, [table]);
      searchColumns = columnsResult.rows.map(r => r.column_name);
    }

    if (searchColumns.length === 0) {
      return res.status(400).json({ error: 'No searchable columns found' });
    }

    // Build search query
    const whereConditions = searchColumns.map(col =>
      `${col}::text ILIKE $1`
    ).join(' OR ');

    const query = `
      SELECT * FROM ${table}
      WHERE ${whereConditions}
      LIMIT $2
    `;

    const result = await pool.query(query, [`%${searchTerm}%`, limit]);

    res.json({
      data: result.rows,
      total: result.rows.length,
      searchTerm,
      searchedColumns: searchColumns
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Database stats endpoint
app.get('/api/stats', async (req, res) => {
  try {
    const statsQuery = `
      SELECT
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public') as total_tables,
        (SELECT pg_size_pretty(pg_database_size(current_database()))) as database_size,
        (SELECT version()) as postgres_version
    `;

    const result = await pool.query(statsQuery);

    // Get all tables with row counts
    const tablesQuery = `
      SELECT
        tablename,
        n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `;

    const tablesResult = await pool.query(tablesQuery);

    res.json({
      ...result.rows[0],
      tables: tablesResult.rows,
      total_records: tablesResult.rows.reduce((sum, t) => sum + parseInt(t.row_count || 0), 0),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
server.listen(PORT, () => {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║                                                               ║');
  console.log('║        🚀 WATCHTOWER COMMAND CENTER - ONLINE 🚀              ║');
  console.log('║                                                               ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');
  console.log('');
  console.log(`  🌐 API Server:       http://localhost:${PORT}`);
  console.log(`  🔌 WebSocket:        ws://localhost:${PORT}`);
  console.log(`  💾 Database:         Neon PostgreSQL`);
  console.log('');
  console.log('  📡 Available Endpoints:');
  console.log('     GET  /api/health              - Health check');
  console.log('     GET  /api/schema              - Database schema');
  console.log('     GET  /api/stats               - Database statistics');
  console.log('     GET  /api/tables/:tableName   - Table details');
  console.log('     GET  /api/analytics/:table    - Analytics data');
  console.log('     POST /api/query               - Dynamic queries');
  console.log('     POST /api/search              - Full-text search');
  console.log('');
  console.log('═'.repeat(65));
});

export { broadcast };
