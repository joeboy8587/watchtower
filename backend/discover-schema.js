import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';
import { writeFileSync } from 'fs';

dotenv.config();

async function discoverSchema() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log('🔌 Connected to Neon database');
    console.log('═'.repeat(80));

    // Get all tables with row counts
    const tablesQuery = `
      SELECT
        t.schemaname,
        t.tablename,
        COALESCE(s.n_live_tup, 0) as row_count,
        pg_size_pretty(pg_total_relation_size(t.schemaname||'.'||t.tablename)) AS size
      FROM pg_tables t
      LEFT JOIN pg_stat_user_tables s ON t.tablename = s.relname AND t.schemaname = s.schemaname
      WHERE t.schemaname NOT IN ('pg_catalog', 'information_schema')
      ORDER BY COALESCE(s.n_live_tup, 0) DESC;
    `;

    const tablesResult = await client.query(tablesQuery);

    console.log('\n📊 DATABASE TABLES:\n');
    const schema = {
      tables: [],
      totalRecords: 0,
      discoveredAt: new Date().toISOString()
    };

    for (const table of tablesResult.rows) {
      const fullTableName = `${table.schemaname}.${table.tablename}`;
      console.log(`\n${'─'.repeat(80)}`);
      console.log(`📋 TABLE: ${fullTableName}`);
      console.log(`   Rows: ${parseInt(table.row_count).toLocaleString()}`);
      console.log(`   Size: ${table.size}`);

      schema.totalRecords += parseInt(table.row_count);

      // Get columns
      const columnsQuery = `
        SELECT
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2
        ORDER BY ordinal_position;
      `;

      const columnsResult = await client.query(columnsQuery, [
        table.schemaname,
        table.tablename,
      ]);

      console.log('\n   📝 Columns:');
      const columns = columnsResult.rows.map(col => {
        const nullable = col.is_nullable === 'YES' ? '?' : '';
        const length = col.character_maximum_length ? `(${col.character_maximum_length})` : '';
        console.log(`      • ${col.column_name}: ${col.data_type}${length}${nullable}`);
        return {
          name: col.column_name,
          type: col.data_type,
          nullable: col.is_nullable === 'YES',
          maxLength: col.character_maximum_length,
          default: col.column_default
        };
      });

      // Get sample data
      const sampleQuery = `SELECT * FROM ${fullTableName} LIMIT 3`;
      const sampleResult = await client.query(sampleQuery);

      if (sampleResult.rows.length > 0) {
        console.log('\n   🔍 Sample Data:');
        sampleResult.rows.forEach((row, i) => {
          console.log(`      Row ${i + 1}:`, JSON.stringify(row, null, 2).substring(0, 200) + '...');
        });
      }

      // Get indexes
      const indexQuery = `
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = $1 AND tablename = $2;
      `;
      const indexResult = await client.query(indexQuery, [
        table.schemaname,
        table.tablename,
      ]);

      if (indexResult.rows.length > 0) {
        console.log('\n   🔑 Indexes:');
        indexResult.rows.forEach(idx => {
          console.log(`      • ${idx.indexname}`);
        });
      }

      schema.tables.push({
        schema: table.schemaname,
        name: table.tablename,
        fullName: fullTableName,
        rowCount: parseInt(table.row_count),
        size: table.size,
        columns,
        indexes: indexResult.rows.map(idx => idx.indexname),
        sampleData: sampleResult.rows
      });
    }

    console.log('\n' + '═'.repeat(80));
    console.log(`\n📈 TOTAL RECORDS: ${schema.totalRecords.toLocaleString()}`);
    console.log(`📦 TOTAL TABLES: ${schema.tables.length}`);
    console.log('═'.repeat(80));

    // Save schema to file
    writeFileSync('database-schema.json', JSON.stringify(schema, null, 2));
    console.log('\n✅ Schema saved to database-schema.json\n');

    return schema;

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

discoverSchema().catch(console.error);
