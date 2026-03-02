// server/db.js
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const { Pool } = require("pg");

const hasPg = !!process.env.DATABASE_URL;

let pool = null;

// --- helper: convert sqlite ? placeholders to pg $1,$2...
function toPg(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// --- db-like wrapper so your server.js doesn't need mass edits
let db;

if (hasPg) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  db = {
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
          // emulate sqlite "this.changes"
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
} else {
  // локально — sqlite файл
  const dbFile = path.join(__dirname, "market.sqlite");
  const sqlite = new sqlite3.Database(dbFile);
  db = sqlite;
}

// --- init: создадим минимальные таблицы в Postgres, если их нет
async function init() {
  if (!hasPg) return;

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

  // опционально (чтобы не падали лайки/рейтинги, если они вызываются)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_likes (
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id) ON DELETE CASCADE,
      PRIMARY KEY (user_id, product_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_ratings (
      user_id INT REFERENCES users(id) ON DELETE CASCADE,
      product_id INT REFERENCES products(id) ON DELETE CASCADE,
      rating INT NOT NULL,
      PRIMARY KEY (user_id, product_id)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS seller_follows (
      follower_user_id INT REFERENCES users(id) ON DELETE CASCADE,
      seller_user_id INT REFERENCES users(id) ON DELETE CASCADE,
      PRIMARY KEY (follower_user_id, seller_user_id)
    );
  `);
}

module.exports = { db, init, pool };