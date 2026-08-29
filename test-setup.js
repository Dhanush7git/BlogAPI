const { Pool } = require('pg');
const Redis = require('ioredis');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

const redis = new Redis(process.env.REDIS_URL);

async function runTests() {
  console.log('--- STARTING PHASE 1 VERIFICATION ---');

  try {
    const pgRes = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public';
    `);
    console.log('✅ PostgreSQL Connected Successfully!');
    console.log('📁 Tables found in Neon database:', pgRes.rows.map(r => r.table_name).join(', '));
  } catch (err) {
    console.error('❌ PostgreSQL Connection Failed:', err.message);
  }

  try {
    await redis.set('test_key', 'Phase 1 working!');
    const val = await redis.get('test_key');
    console.log('✅ Upstash Redis Connected Successfully! Test value:', val);
    await redis.del('test_key');
  } catch (err) {
    console.error('❌ Redis Connection Failed:', err.message);
  }

  await pool.end();
  redis.quit();
  console.log('--- VERIFICATION COMPLETE ---');
}

runTests();