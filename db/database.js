const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function initDatabase() {
  try {
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await pool.query(schema);
    console.log('Database initialized');
  } catch (err) {
    console.error('Database init error:', err.message);
    throw err;
  }
}

async function query(text, params) {
  return pool.query(text, params);
}

module.exports = { pool, query, initDatabase };
