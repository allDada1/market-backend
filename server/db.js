// server/db.js
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

const db = {
  get(sql, params, cb) {
    pool.query(toPg(sql), params || [])
      .then(r => cb(null, r.rows[0] || null))
      .catch(e => cb(e));
  },
  all(sql, params, cb) {
    pool.query(toPg(sql), params || [])
      .then(r => cb(null, r.rows || []))
      .catch(e => cb(e));
  },
  run(sql, params, cb) {
    pool.query(toPg(sql), params || [])
      .then(r => {
        if (typeof cb === "function") cb.call({ changes: r.rowCount }, null);
      })
      .catch(e => {
        if (typeof cb === "function") cb(e);
      });
  },
  exec(sql, cb) {
    pool.query(sql)
      .then(() => cb && cb(null))
      .catch(e => cb && cb(e));
  },
  serialize(fn) { fn(); },
};

async function init() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      pass_salt TEXT NOT NULL,
      pass_hash TEXT NOT NULL,
      is_admin BOOLEAN DEFAULT FALSE,
      nickname TEXT DEFAULT '',
      avatar_url TEXT DEFAULT ''
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      price INT NOT NULL,
      stock INT DEFAULT 0,
      category TEXT DEFAULT '',
      image_url TEXT DEFAULT '',
      tile_slug TEXT DEFAULT '',
      section TEXT DEFAULT '',
      owner_user_id INT REFERENCES users(id)
    );
  `);
}

module.exports = { db, init, pool };