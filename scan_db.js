const { Client } = require('pg');

const connectionString = process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_5rdBU3TNLajm@ep-lucky-wildflower-aak3bzke-pooler.westus3.azure.neon.tech/neondb?sslmode=require&channel_binding=require';

async function scanDatabase() {
  const client = new Client({ connectionString });

  try {
    await client.connect();
    console.log('✅ Connected to Neon database\n');

    // Get all tables
    const tablesResult = await client.query(`
      SELECT
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
      FROM pg_tables
      WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY tablename;
    `);

    console.log('📊 TABLES IN DATABASE:');
    console.log('='.repeat(80));
    tablesResult.rows.forEach(row => {
      console.log(`  ${row.schemaname}.${row.tablename} (${row.size})`);
    });
    console.log('\n');

    // For each table, get schema and row count
    for (const table of tablesResult.rows) {
      const fullTableName = `${table.schemaname}.${table.tablename}`;
      console.log(`\n${'='.repeat(80)}`);
      console.log(`TABLE: ${fullTableName}`);
      console.log('='.repeat(80));

      // Get row count
      const countResult = await client.query(`SELECT COUNT(*) FROM ${fullTableName}`);
      console.log(`Row Count: ${parseInt(countResult.rows[0].count).toLocaleString()}`);

      // Get column information
      const columnsResult = await client.query(`
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
      `, [table.schemaname, table.tablename]);

      console.log('\nColumns:');
      columnsResult.rows.forEach(col => {
        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default}` : '';
        console.log(`  - ${col.column_name}: ${col.data_type}${length} ${nullable}${defaultVal}`);
      });

      // Get sample data (first 3 rows)
      const sampleResult = await client.query(`SELECT * FROM ${fullTableName} LIMIT 3`);
      if (sampleResult.rows.length > 0) {
        console.log('\nSample Data (first 3 rows):');
        console.log(JSON.stringify(sampleResult.rows, null, 2));
      }

      // Get indexes
      const indexResult = await client.query(`
        SELECT
          indexname,
          indexdef
        FROM pg_indexes
        WHERE schemaname = $1 AND tablename = $2;
      `, [table.schemaname, table.tablename]);

      if (indexResult.rows.length > 0) {
        console.log('\nIndexes:');
        indexResult.rows.forEach(idx => {
          console.log(`  - ${idx.indexname}`);
        });
      }
    }

    // Get total database stats
    console.log('\n\n' + '='.repeat(80));
    console.log('DATABASE STATISTICS');
    console.log('='.repeat(80));

    const dbStatsResult = await client.query(`
      SELECT
        pg_size_pretty(pg_database_size(current_database())) AS database_size,
        (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema NOT IN ('pg_catalog', 'information_schema')) AS total_tables;
    `);

    console.log(`Total Database Size: ${dbStatsResult.rows[0].database_size}`);
    console.log(`Total Tables: ${dbStatsResult.rows[0].total_tables}`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await client.end();
  }
}

scanDatabase();
