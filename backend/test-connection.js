import pkg from 'pg';
const { Client } = pkg;
import dotenv from 'dotenv';

dotenv.config();

console.log('🔍 Testing Neon Database Connection...\n');
console.log('Connection String:', process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));
console.log('');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false
  }
});

async function testConnection() {
  try {
    console.log('⏳ Attempting to connect...');
    await client.connect();
    console.log('✅ Successfully connected to Neon database!\n');

    // Test query
    console.log('📊 Testing query...');
    const result = await client.query('SELECT version(), current_database(), current_user');
    console.log('✅ Query successful!\n');
    console.log('Database Info:');
    console.log('  Version:', result.rows[0].version.split(' ')[0], result.rows[0].version.split(' ')[1]);
    console.log('  Database:', result.rows[0].current_database);
    console.log('  User:', result.rows[0].current_user);
    console.log('');

    // Get table count
    const tablesResult = await client.query(`
      SELECT COUNT(*) as table_count
      FROM information_schema.tables
      WHERE table_schema = 'public'
    `);
    console.log('  Tables:', tablesResult.rows[0].table_count);

    // Get total records
    const statsResult = await client.query(`
      SELECT tablename, n_live_tup as row_count
      FROM pg_stat_user_tables
      ORDER BY n_live_tup DESC
    `);

    if (statsResult.rows.length > 0) {
      const totalRecords = statsResult.rows.reduce((sum, t) => sum + parseInt(t.row_count || 0), 0);
      console.log('  Total Records:', totalRecords.toLocaleString());
      console.log('\n📋 Tables:');
      statsResult.rows.forEach(t => {
        console.log(`    - ${t.tablename}: ${parseInt(t.row_count || 0).toLocaleString()} rows`);
      });
    }

    console.log('\n✅ CONNECTION TEST SUCCESSFUL!');
    console.log('Your Neon database is ready for the command center.\n');

  } catch (error) {
    console.error('❌ CONNECTION FAILED!\n');
    console.error('Error Type:', error.code || error.name);
    console.error('Error Message:', error.message);
    console.error('');

    if (error.code === 'ENOTFOUND' || error.code === 'EAI_AGAIN') {
      console.error('🔧 DNS Resolution Issue:');
      console.error('   - Check your internet connection');
      console.error('   - Verify the Neon hostname is correct');
      console.error('   - Try using a different DNS server');
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🔧 Connection Refused:');
      console.error('   - Database might be paused (Neon auto-pauses inactive databases)');
      console.error('   - Check if the database is running in Neon console');
    } else if (error.code === '28P01') {
      console.error('🔧 Authentication Failed:');
      console.error('   - Check your username and password');
      console.error('   - Verify the connection string is correct');
    } else if (error.code === 'ETIMEDOUT') {
      console.error('🔧 Connection Timeout:');
      console.error('   - Check firewall settings');
      console.error('   - Verify network connectivity');
    } else {
      console.error('🔧 Troubleshooting:');
      console.error('   - Verify connection string in backend/.env');
      console.error('   - Check Neon database status at neon.tech');
      console.error('   - Ensure database is not paused');
    }
    console.error('');
    process.exit(1);
  } finally {
    await client.end();
  }
}

testConnection();
